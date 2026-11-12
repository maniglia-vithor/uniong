import os
from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from google.oauth2 import id_token as google_id_token
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from decimal import Decimal

from django.db.models import Case, Count, DecimalField, F, ProtectedError, Q, Sum, Value, When
from django.db.models.functions import Coalesce
from django.http import FileResponse
from rest_framework import viewsets
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from django.db import transaction

from .models import Apoiador, Campanha, Contribuicao, Doacao, Comunicado, Notificacao, Despesa, DespesaAnexo, ConfiguracaoInstituicao, ConfiguracaoPix, LogAlteracao
from .anexos import TIPOS_PERMITIDOS, validar_anexo
from .doacao_publica import DoacaoPublicaSerializer, ativar_membro_interessado, registrar_doacao_publica
from . import indicadores
from .auditoria import AuditoriaMixin, registrar as registrar_auditoria
from .campanhas_publicas import avisar_meta_atingida, validar_imagem
from .paginacao import filtrar_periodo
from .portal import CATEGORIA_AGREGADA, despesas_publicas
from .pix import mascarar
from .throttles import AuthThrottle, DoacaoPublicaThrottle
from .serializers import ApoiadorSerializer, CampanhaSerializer, ContribuicaoSerializer, DoacaoSerializer, ComunicadoSerializer, NotificacaoSerializer, DespesaSerializer, DespesaAnexoSerializer, ConfiguracaoPixSerializer, ConfiguracaoInstituicaoSerializer, LogAlteracaoSerializer


def _notificar_admins(mensagem, tipo, actor_name='', action_text='', target_type='', target_id=None):
    User = get_user_model()
    admins = User.objects.filter(is_staff=True, is_active=True)
    Notificacao.objects.bulk_create([
        Notificacao(
            usuario=u,
            mensagem=mensagem,
            tipo=tipo,
            actor_name=actor_name,
            action_text=action_text,
            target_type=target_type,
            target_id=target_id,
        ) for u in admins
    ])


class ExclusaoProtegidaMixin:
    """Responde 400 com mensagem clara quando o registro tem dependentes protegidos (PROTECT)."""

    mensagem_exclusao_protegida = 'Este registro não pode ser excluído porque possui registros vinculados.'

    def destroy(self, request, *args, **kwargs):
        try:
            with transaction.atomic():
                return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'erro': self.mensagem_exclusao_protegida}, status=400)


class ApoiadorViewSet(AuditoriaMixin, ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    serializer_class = ApoiadorSerializer
    mensagem_exclusao_protegida = 'Não é possível excluir: este membro possui doações vinculadas.'
    search_fields = ['nome', 'email']
    ordering_fields = ['nome', 'email', 'celular', 'data_cadastro', 'status', 'total_doado']
    ordering = ['-data_cadastro', '-id']

    def get_queryset(self):
        qs = Apoiador.objects.annotate(
            total_doado=Coalesce(
                Sum('doacoes__valor', filter=Q(doacoes__status='confirmada', doacoes__tipo='financeira')),
                Value(Decimal('0')),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=False, methods=['get'], pagination_class=None, filter_backends=[])
    def opcoes(self, request):
        """Lista leve para seleção: membros ativos (id e nome), sem paginação."""
        dados = Apoiador.objects.filter(status='ativo').order_by('nome').values('id', 'nome')
        return Response(list(dados))

    def perform_create(self, serializer):
        apoiador = serializer.save()
        actor = self.request.user.get_full_name() or self.request.user.username
        _notificar_admins(
            mensagem=f'{actor} cadastrou um novo membro: {apoiador.nome}.',
            tipo='apoiador',
            actor_name=actor,
            action_text=f'cadastrou um novo membro: {apoiador.nome}',
            target_type='apoiador',
            target_id=apoiador.id,
        )


class CampanhaViewSet(AuditoriaMixin, ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    serializer_class = CampanhaSerializer
    mensagem_exclusao_protegida = (
        'Não é possível excluir: existem doações ou despesas vinculadas a esta campanha. Encerre a campanha em vez de excluí-la.'
    )
    search_fields = ['titulo']
    ordering_fields = ['titulo', 'meta_valor', 'arrecadado', 'progresso', 'data_inicio', 'data_fim', 'status']
    ordering = ['-data_inicio', '-id']

    def get_queryset(self):
        qs = Campanha.objects.com_arrecadado().annotate(
            progresso=Case(
                When(meta_valor__gt=0, then=F('arrecadado') * 100 / F('meta_valor')),
                default=Value(Decimal('0')),
                output_field=DecimalField(max_digits=14, decimal_places=2),
            )
        )
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

    @action(detail=False, methods=['get'], pagination_class=None, filter_backends=[])
    def opcoes(self, request):
        """Lista leve para seleção (id, título e status), sem paginação. Padrão: só ativas;
        ?incluir_encerradas=1 traz todas (usado para vincular despesas)."""
        qs = Campanha.objects.all()
        if request.query_params.get('incluir_encerradas') != '1':
            qs = Campanha.objects.em_andamento()
        return Response(list(qs.order_by('titulo').values('id', 'titulo', 'status')))

    @action(detail=True, methods=['post', 'delete'], url_path='imagem')
    def imagem(self, request, pk=None):
        """POST (multipart, campo "imagem") envia a imagem pública da campanha; DELETE remove."""
        campanha = self.get_object()
        if request.method == 'DELETE':
            if campanha.imagem:
                campanha.imagem.delete(save=False)
            Campanha.objects.filter(pk=campanha.pk).update(imagem='')
            return Response(status=204)
        arquivo = request.FILES.get('imagem')
        if arquivo is None:
            return Response({'imagem': 'Envie um arquivo no campo "imagem".'}, status=400)
        try:
            validar_imagem(arquivo)
        except ValueError as e:
            return Response({'imagem': str(e)}, status=400)
        if campanha.imagem:
            campanha.imagem.delete(save=False)
        campanha.imagem = arquivo
        campanha.save(update_fields=['imagem'])
        registrar_auditoria(request.user, campanha, 'edicao', 'imagem', '', campanha.imagem.name)
        return Response({'imagem_url': f'/api/public/campanhas/{campanha.pk}/imagem/'})

    @action(detail=True, methods=['get'], pagination_class=None, filter_backends=[])
    def despesas(self, request, pk=None):
        """Despesas pagas vinculadas à campanha (prestação de contas da campanha)."""
        campanha = self.get_object()
        despesas = campanha.despesas.filter(status='pago').order_by('-data_pagamento', '-id')
        return Response(DespesaSerializer(despesas, many=True, context={'request': request}).data)

    def perform_create(self, serializer):
        campanha = serializer.save()
        actor = self.request.user.get_full_name() or self.request.user.username
        meta = f'R$ {campanha.meta_valor:.2f}'.replace('.', ',') if campanha.meta_valor else None
        meta_txt = f' (Meta: {meta})' if meta else ''
        _notificar_admins(
            mensagem=f'{actor} criou a campanha: {campanha.titulo}{meta_txt}.',
            tipo='campanha',
            actor_name=actor,
            action_text=f'criou a campanha: {campanha.titulo}{meta_txt}',
            target_type='campanha',
            target_id=campanha.id,
        )


class DoacaoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = DoacaoSerializer
    search_fields = ['apoiador__nome', 'campanha__titulo', 'descricao_bens', 'observacao']
    ordering_fields = ['apoiador__nome', 'campanha__titulo', 'valor', 'data', 'status', 'forma_pagamento']
    ordering = ['-data', '-id']

    def get_queryset(self):
        qs = Doacao.objects.select_related('apoiador', 'campanha')
        status = self.request.query_params.get('status')
        campanha = self.request.query_params.get('campanha')
        apoiador = self.request.query_params.get('apoiador')
        if status:
            qs = qs.filter(status=status)
        if campanha:
            qs = qs.filter(campanha_id=campanha)
        if apoiador:
            qs = qs.filter(apoiador_id=apoiador)
        for campo in ('tipo', 'forma_pagamento'):
            valor = self.request.query_params.get(campo)
            if valor:
                qs = qs.filter(**{campo: valor})
        if self.request.query_params.get('anonima') == 'true':
            qs = qs.filter(apoiador__isnull=True)
        return filtrar_periodo(qs, self.request, 'data')

    @action(detail=False, methods=['get'], pagination_class=None)
    def resumo(self, request):
        """Totais de todos os registros que atendem aos filtros (não só da página)."""
        qs = self.filter_queryset(self.get_queryset())
        confirmadas = qs.filter(status='confirmada', tipo='financeira').aggregate(total=Sum('valor'), quantidade=Count('id'))
        bens = qs.filter(status='confirmada', tipo='bens').aggregate(estimado=Sum('valor_estimado'), quantidade=Count('id'))
        return Response({
            'quantidade': qs.count(),
            'total_confirmado': float(confirmadas['total'] or 0),
            'quantidade_confirmadas': confirmadas['quantidade'],
            'bens_quantidade': bens['quantidade'],
            'bens_valor_estimado': float(bens['estimado'] or 0),
        })

    @action(detail=True, methods=['get', 'post', 'delete'], url_path='comprovante')
    def comprovante(self, request, pk=None):
        """GET baixa, POST (multipart, campo "comprovante") envia/substitui, DELETE remove o comprovante."""
        doacao = self.get_object()
        if request.method == 'GET':
            if not doacao.comprovante:
                return Response({'erro': 'Esta doação não tem comprovante.'}, status=404)
            return _resposta_arquivo(doacao.comprovante, doacao.comprovante_nome)
        anterior = doacao.comprovante_nome
        if request.method == 'DELETE':
            if doacao.comprovante:
                doacao.comprovante.delete(save=False)
            Doacao.objects.filter(pk=doacao.pk).update(comprovante='', comprovante_nome='')
            registrar_auditoria(request.user, doacao, 'edicao', 'comprovante', anterior, '')
            return Response(status=204)
        arquivo = request.FILES.get('comprovante')
        if arquivo is None:
            return Response({'comprovante': 'Envie um arquivo no campo "comprovante".'}, status=400)
        try:
            validar_anexo(arquivo)
        except ValueError as e:
            return Response({'comprovante': str(e)}, status=400)
        if doacao.comprovante:
            doacao.comprovante.delete(save=False)
        doacao.comprovante_nome = os.path.basename(arquivo.name)[:255]
        doacao.comprovante = arquivo
        doacao.save(update_fields=['comprovante', 'comprovante_nome'])
        registrar_auditoria(request.user, doacao, 'edicao', 'comprovante', anterior, doacao.comprovante_nome)
        return Response(DoacaoSerializer(doacao).data)

    def perform_update(self, serializer):
        doacao = serializer.save()
        ativar_membro_interessado(doacao)
        if doacao.status == 'confirmada' and doacao.campanha_id:
            avisar_meta_atingida(doacao.campanha)

    @action(detail=False, methods=['post'], url_path='acao-em-lote')
    def acao_em_lote(self, request):
        """Confirma ou cancela várias doações pendentes de uma vez: {"ids": [...], "acao": "confirmar"|"cancelar"}."""
        novo_status = {'confirmar': 'confirmada', 'cancelar': 'cancelada'}.get(request.data.get('acao'))
        ids = request.data.get('ids')
        if novo_status is None:
            return Response({'erro': 'Ação inválida. Use "confirmar" ou "cancelar".'}, status=400)
        if not isinstance(ids, list) or not ids or not all(isinstance(i, int) for i in ids):
            return Response({'erro': 'Informe a lista de ids das doações.'}, status=400)
        doacoes = list(Doacao.objects.select_related('apoiador').filter(pk__in=ids, status='pendente'))
        for doacao in doacoes:
            doacao.status = novo_status
            doacao.save(update_fields=['status'])
            registrar_auditoria(request.user, doacao, 'edicao', 'status', 'pendente', novo_status)
            ativar_membro_interessado(doacao)
        for campanha_id in {d.campanha_id for d in doacoes if d.campanha_id and novo_status == 'confirmada'}:
            avisar_meta_atingida(Campanha(pk=campanha_id))
        return Response({'atualizadas': len(doacoes), 'ignoradas': len(set(ids)) - len(doacoes)})

    def perform_create(self, serializer):
        doacao = serializer.save()
        ativar_membro_interessado(doacao)
        if doacao.status == 'confirmada' and doacao.campanha_id:
            avisar_meta_atingida(doacao.campanha)
        actor = self.request.user.get_full_name() or self.request.user.username
        valor = 'em bens' if doacao.tipo == 'bens' else f'de R$ {doacao.valor:.2f}'.replace('.', ',')
        campanha_txt = f' para a campanha {doacao.campanha.titulo}' if doacao.campanha else ''
        _notificar_admins(
            mensagem=f'{actor} registrou uma nova doação {valor} realizada por {doacao.nome_doador}{campanha_txt}.'[:300],
            tipo='doacao',
            actor_name=actor,
            action_text=f'registrou uma nova doação {valor} realizada por {doacao.nome_doador}{campanha_txt}'[:200],
            target_type='doacao',
            target_id=doacao.id,
        )


class ContribuicaoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Contribuições periódicas (mensalidades). ?apoiador=<id> filtra pela ficha do membro."""
    serializer_class = ContribuicaoSerializer
    ordering = ['-ativa', 'apoiador__nome', 'id']

    def get_queryset(self):
        qs = Contribuicao.objects.select_related('apoiador')
        apoiador = self.request.query_params.get('apoiador')
        if apoiador:
            qs = qs.filter(apoiador_id=apoiador)
        return qs


class NotificacaoViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacaoSerializer
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Notificacao.objects.filter(usuario=self.request.user)

    @action(detail=False, methods=['post'], url_path='marcar-todas-lidas')
    def marcar_todas_lidas(self, request):
        Notificacao.objects.filter(usuario=request.user, lida=False).update(lida=True)
        return Response({'ok': True})


class DashboardViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        return Response(indicadores.resumo_painel())

    @action(detail=False, methods=['get'], url_path='grafico-mensal')
    def grafico_mensal(self, request):
        return Response(indicadores.serie_mensal_doacoes())

    @action(detail=False, methods=['get'], url_path='fluxo-mensal')
    def fluxo_mensal(self, request):
        """Receitas × despesas dos últimos 12 meses, com saldo do mês e saldo acumulado."""
        return Response(indicadores.fluxo_mensal())

    @action(detail=False, methods=['get'], url_path='doacoes-recentes')
    def doacoes_recentes(self, request):
        doacoes = Doacao.objects.select_related('apoiador', 'campanha').order_by('-data', '-id')[:10]
        return Response(DoacaoSerializer(doacoes, many=True).data)

    @action(detail=False, methods=['get'], url_path='top-apoiadores')
    def top_apoiadores(self, request):
        top = (
            Apoiador.objects
            .filter(doacoes__status='confirmada', doacoes__tipo='financeira')
            .annotate(total_doado=Sum('doacoes__valor'))
            .order_by('-total_doado')[:5]
        )
        return Response([
            {'id': a.id, 'nome': a.nome, 'total_doado': float(a.total_doado or 0)}
            for a in top
        ])

    @action(detail=False, methods=['get'], url_path='campanhas-ativas')
    def campanhas_ativas(self, request):
        campanhas = Campanha.objects.em_andamento().com_arrecadado().order_by('-data_inicio')
        return Response(CampanhaSerializer(campanhas, many=True).data)

    @staticmethod
    def _lista_doacoes(qs):
        return [
            {
                'id': d.id,
                'apoiador_nome': d.nome_doador,
                'valor': float(d.valor),
                'data': d.data.isoformat(),
                'campanha': d.campanha.titulo if d.campanha else None,
            }
            for d in qs.select_related('apoiador', 'campanha').order_by('-data', '-id')
        ]

    @action(detail=False, methods=['get'], url_path='kpi-doacoes')
    def kpi_doacoes(self, request):
        return Response(self._lista_doacoes(indicadores.doacoes_confirmadas()))

    @action(detail=False, methods=['get'], url_path='doacoes-por-mes')
    def doacoes_por_mes(self, request):
        """Doações confirmadas de um mês específico (?mes=AAAA-MM)."""
        mes_param = request.query_params.get('mes')
        if not mes_param:
            return Response({'erro': 'Parâmetro "mes" obrigatório (ex: 2026-11).'}, status=400)
        try:
            mes = indicadores.mes_do_parametro(mes_param)
        except ValueError:
            return Response({'erro': 'Formato inválido. Use AAAA-MM.'}, status=400)
        return Response(self._lista_doacoes(indicadores.doacoes_do_mes(mes)))

    @action(detail=False, methods=['get'], url_path='kpi-doacoes-mes')
    def kpi_doacoes_mes(self, request):
        return Response(self._lista_doacoes(indicadores.doacoes_do_mes()))

    @action(detail=False, methods=['get'], url_path='kpi-apoiadores-ativos')
    def kpi_apoiadores_ativos(self, request):
        return Response([
            {'id': a.id, 'nome': a.nome, 'email': a.email, 'data_cadastro': a.data_cadastro.isoformat()}
            for a in indicadores.membros_ativos().order_by('nome')
        ])

    @action(detail=False, methods=['get'], url_path='kpi-campanhas-ativas')
    def kpi_campanhas_ativas(self, request):
        campanhas = indicadores.campanhas_ativas().com_arrecadado().order_by('-data_inicio')
        return Response([
            {
                'id': c.id,
                'titulo': c.titulo,
                'data_inicio': c.data_inicio.isoformat(),
                'data_fim': c.data_fim.isoformat() if c.data_fim else None,
                'meta_valor': float(c.meta_valor),
                'valor_arrecadado': float(c.valor_arrecadado),
            }
            for c in campanhas
        ])


class DespesaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = DespesaSerializer
    search_fields = ['descricao']
    ordering_fields = ['descricao', 'categoria', 'data_vencimento', 'data_pagamento', 'valor', 'status']
    ordering = ['-data_vencimento', '-id']

    def get_queryset(self):
        qs = Despesa.objects.select_related('campanha').prefetch_related('anexos')
        status = self.request.query_params.get('status')
        categoria = self.request.query_params.get('categoria')
        if status == 'atrasado':
            qs = qs.filter(status='pendente', data_vencimento__lt=indicadores.hoje())
        elif status:
            qs = qs.filter(status=status)
        if categoria:
            qs = qs.filter(categoria=categoria)
        return filtrar_periodo(qs, self.request, 'data_vencimento')

    def _anexos_validados(self):
        arquivos = self.request.FILES.getlist('anexos')
        erros = []
        for arq in arquivos:
            try:
                validar_anexo(arq)
            except ValueError as e:
                erros.append(str(e))
        if erros:
            raise ValidationError({'anexos': erros})
        return arquivos

    def _salvar_anexos(self, despesa, arquivos):
        for arq in arquivos:
            anexo = DespesaAnexo(despesa=despesa, nome_original=os.path.basename(arq.name)[:255])
            anexo.arquivo = arq
            anexo.save()

    def perform_create(self, serializer):
        arquivos = self._anexos_validados()
        despesa = serializer.save()
        if arquivos:
            self._salvar_anexos(despesa, arquivos)
        actor = self.request.user.get_full_name() or self.request.user.username
        valor = f'R$ {despesa.valor:.2f}'.replace('.', ',')
        tipo_txt = 'fixa' if despesa.is_fixed else 'variável'
        _notificar_admins(
            mensagem=f'{actor} registrou uma nova despesa {tipo_txt} de {valor} ({despesa.descricao}).',
            tipo='despesa',
            actor_name=actor,
            action_text=f'registrou uma nova despesa {tipo_txt} de {valor} ({despesa.descricao})',
            target_type='despesa',
            target_id=despesa.id,
        )

    def perform_update(self, serializer):
        arquivos = self._anexos_validados()
        status_anterior = serializer.instance.status
        despesa = serializer.save()
        if arquivos:
            self._salvar_anexos(despesa, arquivos)
        # A próxima ocorrência da série só nasce quando a atual é paga.
        if status_anterior != 'pago' and despesa.status == 'pago':
            despesa.gerar_proxima_recorrencia()

    @action(detail=True, methods=['post'], url_path='encerrar-serie')
    def encerrar_serie(self, request, pk=None):
        """Define o fim da série (padrão: vencimento desta ocorrência) e apaga as pendentes posteriores."""
        despesa = self.get_object()
        if despesa.serie_id is None:
            return Response({'erro': 'Esta despesa não faz parte de uma série recorrente.'}, status=400)
        fim = despesa.data_vencimento
        if request.data.get('recorrencia_fim'):
            try:
                fim = date.fromisoformat(request.data['recorrencia_fim'])
            except (TypeError, ValueError):
                return Response({'recorrencia_fim': 'Data inválida. Use AAAA-MM-DD.'}, status=400)
        apagadas = despesa.encerrar_serie(fim)
        return Response({'recorrencia_fim': fim.isoformat(), 'ocorrencias_apagadas': apagadas})

    @action(detail=True, methods=['post'], url_path='aplicar-valor-proximas')
    def aplicar_valor_proximas(self, request, pk=None):
        despesa = self.get_object()
        if despesa.serie_id is None:
            return Response({'erro': 'Esta despesa não faz parte de uma série recorrente.'}, status=400)
        return Response({'atualizadas': despesa.aplicar_valor_as_proximas()})

    @action(detail=True, methods=['patch', 'delete'], url_path=r'anexos/(?P<anexo_id>\d+)')
    def anexo(self, request, pk=None, anexo_id=None):
        """PATCH {publico: bool} marca o comprovante como público; DELETE remove o anexo e o arquivo."""
        anexo = DespesaAnexo.objects.filter(pk=anexo_id, despesa_id=pk).first()
        if anexo is None:
            return Response({'erro': 'Anexo não encontrado.'}, status=404)
        if request.method == 'DELETE':
            anexo.arquivo.delete(save=False)
            anexo.delete()
            return Response(status=204)
        publico = request.data.get('publico')
        if not isinstance(publico, bool):
            return Response({'publico': 'Informe true ou false.'}, status=400)
        anexo.publico = publico
        anexo.save(update_fields=['publico'])
        return Response(DespesaAnexoSerializer(anexo).data)

    @action(detail=True, methods=['get'], url_path=r'anexos/(?P<anexo_id>\d+)/download')
    def baixar_anexo(self, request, pk=None, anexo_id=None):
        return _resposta_anexo(DespesaAnexo.objects.filter(pk=anexo_id, despesa_id=pk).first())

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        return Response(indicadores.resumo_despesas())

    @action(detail=False, methods=['get'], url_path='por-categoria')
    def por_categoria(self, request):
        return Response(indicadores.gastos_por_categoria())

class SomenteSuperusuario(BasePermission):
    message = 'Apenas superusuários podem consultar o histórico.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_active and request.user.is_superuser)


class HistoricoViewSet(viewsets.ReadOnlyModelViewSet):
    """Trilha de auditoria: ?modelo=&usuario=&objeto_id=&acao=&data_inicio=&data_fim=."""

    serializer_class = LogAlteracaoSerializer
    permission_classes = [SomenteSuperusuario]
    search_fields = ['campo', 'antes', 'depois']
    ordering_fields = ['data', 'modelo', 'acao']
    ordering = ['-data', '-id']

    def get_queryset(self):
        qs = LogAlteracao.objects.select_related('usuario')
        for param, campo in [('modelo', 'modelo'), ('usuario', 'usuario_id'), ('objeto_id', 'objeto_id'), ('acao', 'acao')]:
            valor = self.request.query_params.get(param)
            if valor:
                qs = qs.filter(**{campo: valor})
        return filtrar_periodo(qs, self.request, 'data__date')


class ComunicadoViewSet(viewsets.ModelViewSet):
    queryset = Comunicado.objects.all()
    serializer_class = ComunicadoSerializer
    search_fields = ['titulo', 'conteudo']
    ordering_fields = ['titulo', 'data_publicacao', 'publico_alvo']
    ordering = ['-data_publicacao', '-id']


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def google_login(request):
    """Troca o id_token (credential) do Google por JWT, apenas para staff já cadastrado."""
    if not settings.GOOGLE_CLIENT_ID:
        return Response({'erro': 'Login com Google não está configurado.'}, status=503)

    credential = request.data.get('credential')
    if not credential or not isinstance(credential, str):
        return Response({'erro': 'Token do Google ausente.'}, status=400)

    try:
        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        return Response({'erro': 'Token do Google inválido.'}, status=401)
    except GoogleAuthError:
        return Response({'erro': 'Não foi possível validar o login com o Google.'}, status=503)

    if not info.get('email_verified'):
        return Response({'erro': 'E-mail do Google não verificado.'}, status=401)

    email = (info.get('email') or '').strip()
    usuario = (
        get_user_model().objects
        .filter(email__iexact=email, is_active=True, is_staff=True)
        .order_by('id')
        .first()
    ) if email else None
    if usuario is None:
        return Response({'erro': 'Conta não autorizada. Peça acesso a um administrador.'}, status=403)

    refresh = RefreshToken.for_user(usuario)
    return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


@api_view(['GET'])
@permission_classes([AllowAny])
def painel_transparencia(request):
    """Endpoint público — sem dados sensíveis."""
    if _portal_desligado():
        return Response(RESPOSTA_PORTAL_DESLIGADO, status=404)
    total_arrecadado = indicadores.total_arrecadado()
    doacoes_mes = indicadores.doacoes_do_mes().aggregate(total=Sum('valor'))['total'] or 0
    apoiadores_ativos = indicadores.membros_ativos().count()

    campanhas = indicadores.campanhas_ativas().com_arrecadado().order_by('-data_inicio')
    campanhas_data = CampanhaSerializer(campanhas, many=True).data

    gastos_mes_qs = indicadores.despesas_pagas_no_mes()
    a_pagar_mes = indicadores.despesas_a_pagar_no_mes().aggregate(total=Sum('valor'))['total'] or 0
    gastos_mes_total = gastos_mes_qs.aggregate(total=Sum('valor'))['total'] or 0
    gastos_mes_lista = despesas_publicas(gastos_mes_qs.prefetch_related('anexos'))

    return Response({
        'kpis': {
            'total_arrecadado': float(total_arrecadado),
            'doacoes_mes': float(doacoes_mes),
            'apoiadores_ativos': apoiadores_ativos,
            'campanhas_ativas': campanhas.count(),
            'gastos_mes': float(gastos_mes_total),
            'a_pagar_mes': float(a_pagar_mes),
        },
        'campanhas': campanhas_data,
        'gastos_mes_lista': gastos_mes_lista,
        'pix': ConfiguracaoPixSerializer(ConfiguracaoPix.obter()).data,
        'comunicados': [
            {
                'id': c.id,
                'titulo': c.titulo,
                'conteudo': c.conteudo,
                'data_publicacao': c.data_publicacao.isoformat(),
            }
            for c in Comunicado.objects.filter(publico_alvo='publico')[:10]
        ],
    })


def _portal_desligado():
    return not ConfiguracaoInstituicao.obter().portal_ativo


RESPOSTA_PORTAL_DESLIGADO = {'erro': 'Portal indisponível.'}


def _resposta_anexo(anexo):
    if anexo is None:
        return Response({'erro': 'Anexo não encontrado.'}, status=404)
    return _resposta_arquivo(anexo.arquivo, anexo.nome_original)


def _resposta_arquivo(arquivo, nome=''):
    """Download seguro: sempre como anexo, com tipo fixo pela extensão e nosniff."""
    if not arquivo or not arquivo.storage.exists(arquivo.name):
        return Response({'erro': 'Anexo não encontrado.'}, status=404)
    extensao = os.path.splitext(arquivo.name)[1].lower()
    resposta = FileResponse(
        arquivo.open('rb'),
        as_attachment=True,
        filename=nome or os.path.basename(arquivo.name),
        content_type=TIPOS_PERMITIDOS.get(extensao, 'application/octet-stream'),
    )
    resposta['X-Content-Type-Options'] = 'nosniff'
    return resposta


@api_view(['GET'])
@permission_classes([AllowAny])
def comprovante_publico(request, despesa_id, anexo_id):
    """Comprovante marcado como público de uma despesa paga (fora de Recursos Humanos)."""
    if _portal_desligado():
        return Response(RESPOSTA_PORTAL_DESLIGADO, status=404)
    anexo = (
        DespesaAnexo.objects
        .filter(pk=anexo_id, despesa_id=despesa_id, publico=True, despesa__status='pago')
        .exclude(despesa__categoria=CATEGORIA_AGREGADA)
        .first()
    )
    return _resposta_anexo(anexo)


@api_view(['GET'])
@permission_classes([AllowAny])
def prestacao_contas_publica(request):
    """Prestação de contas agregada de um ano (?ano=AAAA; padrão: ano atual)."""
    if _portal_desligado():
        return Response(RESPOSTA_PORTAL_DESLIGADO, status=404)
    try:
        ano = int(request.query_params.get('ano') or indicadores.hoje().year)
    except ValueError:
        return Response({'ano': 'Ano inválido.'}, status=400)
    if not 2000 <= ano <= 2100:
        return Response({'ano': 'Ano inválido.'}, status=400)
    return Response(indicadores.prestacao_de_contas(ano))


@api_view(['GET', 'PATCH'])
def configuracao_instituicao(request):
    config = ConfiguracaoInstituicao.obter()
    if request.method == 'GET':
        return Response(ConfiguracaoInstituicaoSerializer(config).data)
    if not request.user.is_superuser:
        return Response({'erro': 'Apenas superusuários podem alterar a configuração da instituição.'}, status=403)
    antes = ConfiguracaoInstituicaoSerializer(config).data
    serializer = ConfiguracaoInstituicaoSerializer(config, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    for campo, novo in serializer.data.items():
        if antes.get(campo) != novo:
            LogAlteracao.objects.create(
                usuario=request.user, modelo='ConfiguracaoInstituicao', objeto_id=config.pk,
                campo=campo, antes=str(antes.get(campo)), depois=str(novo),
            )
    return Response(serializer.data)


CAMPOS_PIX = {'chave': 'chave', 'nome_recebedor': 'nome do recebedor', 'cidade': 'cidade'}


@api_view(['GET', 'PUT'])
def configuracao_pix(request):
    config = ConfiguracaoPix.obter()
    if request.method == 'GET':
        return Response(ConfiguracaoPixSerializer(config).data)

    if not request.user.is_superuser:
        return Response({'erro': 'Apenas superusuários podem alterar a chave PIX.'}, status=403)

    antes = {campo: getattr(config, campo) for campo in CAMPOS_PIX}
    serializer = ConfiguracaoPixSerializer(config, data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        config = serializer.save()
        mudancas = []
        for campo, rotulo in CAMPOS_PIX.items():
            novo = getattr(config, campo)
            if novo == antes[campo]:
                continue
            LogAlteracao.objects.create(
                usuario=request.user, modelo='ConfiguracaoPix', objeto_id=config.pk,
                campo=campo, antes=antes[campo], depois=novo,
            )
            mudancas.append(f'{rotulo} de {mascarar(antes[campo])} para {mascarar(novo)}')
        if mudancas:
            actor = request.user.get_full_name() or request.user.username
            acao = ('alterou a configuração PIX: ' + '; '.join(mudancas))[:200]
            _notificar_admins(
                mensagem=f'{actor} {acao}'[:300],
                tipo='configuracao',
                actor_name=actor,
                action_text=acao,
            )
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([DoacaoPublicaThrottle])
def public_doacao(request):
    """Registra uma intenção de doação feita pelo portal público."""
    if _portal_desligado():
        return Response(RESPOSTA_PORTAL_DESLIGADO, status=404)
    mensagem = 'Intenção de doação registrada! Faça o PIX e aguarde a confirmação da equipe.'
    if (request.data.get('site') or '').strip():
        return Response({'mensagem': mensagem, 'id': None}, status=201)

    serializer = DoacaoPublicaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    doacao = registrar_doacao_publica(serializer.validated_data)

    valor_txt = f'R$ {doacao.valor:.2f}'.replace('.', ',')
    campanha_txt = f' para a campanha {doacao.campanha.titulo}' if doacao.campanha else ''
    nome = doacao.apoiador.nome
    _notificar_admins(
        mensagem=f'Nova intenção de doação de {nome} — {valor_txt}{campanha_txt}.'[:300],
        tipo='doacao',
        actor_name=nome[:150],
        action_text=f'registrou pelo portal uma intenção de doação de {valor_txt}{campanha_txt}'[:200],
        target_type='doacao',
        target_id=doacao.id,
    )
    return Response({
        'mensagem': mensagem,
        'id': doacao.id,
        'valor': f'{doacao.valor:.2f}',
        'txid': f'DOA{doacao.id}',
    }, status=201)
