import os

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
from rest_framework.permissions import AllowAny
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from django.db import transaction

from .models import Apoiador, Campanha, Doacao, Comunicado, Notificacao, Despesa, DespesaAnexo, ConfiguracaoPix, LogAlteracao
from .anexos import TIPOS_PERMITIDOS, validar_anexo
from .doacao_publica import DoacaoPublicaSerializer, ativar_membro_interessado, registrar_doacao_publica
from . import indicadores
from .paginacao import filtrar_periodo
from .pix import mascarar
from .throttles import AuthThrottle, DoacaoPublicaThrottle
from .serializers import ApoiadorSerializer, CampanhaSerializer, DoacaoSerializer, ComunicadoSerializer, NotificacaoSerializer, DespesaSerializer, DespesaAnexoSerializer, ConfiguracaoPixSerializer


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


class ApoiadorViewSet(ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    serializer_class = ApoiadorSerializer
    mensagem_exclusao_protegida = 'Não é possível excluir: este membro possui doações vinculadas.'
    search_fields = ['nome', 'email']
    ordering_fields = ['nome', 'email', 'celular', 'data_cadastro', 'status', 'total_doado']
    ordering = ['-data_cadastro', '-id']

    def get_queryset(self):
        qs = Apoiador.objects.annotate(
            total_doado=Coalesce(
                Sum('doacoes__valor', filter=Q(doacoes__status='confirmada')),
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


class CampanhaViewSet(ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    serializer_class = CampanhaSerializer
    mensagem_exclusao_protegida = (
        'Não é possível excluir: existem doações vinculadas a esta campanha. Encerre a campanha em vez de excluí-la.'
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
        """Lista leve para seleção: campanhas ativas (id e título), sem paginação."""
        dados = Campanha.objects.filter(status='ativa').order_by('titulo').values('id', 'titulo')
        return Response(list(dados))

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


class DoacaoViewSet(viewsets.ModelViewSet):
    serializer_class = DoacaoSerializer
    search_fields = ['apoiador__nome', 'campanha__titulo']
    ordering_fields = ['apoiador__nome', 'campanha__titulo', 'valor', 'data', 'status']
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
        return filtrar_periodo(qs, self.request, 'data')

    @action(detail=False, methods=['get'], pagination_class=None)
    def resumo(self, request):
        """Totais de todos os registros que atendem aos filtros (não só da página)."""
        qs = self.filter_queryset(self.get_queryset())
        confirmadas = qs.filter(status='confirmada').aggregate(total=Sum('valor'), quantidade=Count('id'))
        return Response({
            'quantidade': qs.count(),
            'total_confirmado': float(confirmadas['total'] or 0),
            'quantidade_confirmadas': confirmadas['quantidade'],
        })

    def perform_update(self, serializer):
        ativar_membro_interessado(serializer.save())

    def perform_create(self, serializer):
        doacao = serializer.save()
        ativar_membro_interessado(doacao)
        actor = self.request.user.get_full_name() or self.request.user.username
        valor = f'R$ {doacao.valor:.2f}'.replace('.', ',')
        campanha_txt = f' para a campanha {doacao.campanha.titulo}' if doacao.campanha else ''
        _notificar_admins(
            mensagem=f'{actor} registrou uma nova doação de {valor} realizada por {doacao.apoiador.nome}{campanha_txt}.',
            tipo='doacao',
            actor_name=actor,
            action_text=f'registrou uma nova doação de {valor} realizada por {doacao.apoiador.nome}{campanha_txt}',
            target_type='doacao',
            target_id=doacao.id,
        )


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

    @action(detail=False, methods=['get'], url_path='doacoes-recentes')
    def doacoes_recentes(self, request):
        doacoes = Doacao.objects.select_related('apoiador', 'campanha').order_by('-data', '-id')[:10]
        return Response(DoacaoSerializer(doacoes, many=True).data)

    @action(detail=False, methods=['get'], url_path='top-apoiadores')
    def top_apoiadores(self, request):
        top = (
            Apoiador.objects
            .filter(doacoes__status='confirmada')
            .annotate(total_doado=Sum('doacoes__valor'))
            .order_by('-total_doado')[:5]
        )
        return Response([
            {'id': a.id, 'nome': a.nome, 'total_doado': float(a.total_doado or 0)}
            for a in top
        ])

    @action(detail=False, methods=['get'], url_path='campanhas-ativas')
    def campanhas_ativas(self, request):
        campanhas = Campanha.objects.com_arrecadado().filter(status='ativa').order_by('-data_inicio')
        return Response(CampanhaSerializer(campanhas, many=True).data)

    @staticmethod
    def _lista_doacoes(qs):
        return [
            {
                'id': d.id,
                'apoiador_nome': d.apoiador.nome,
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


class DespesaViewSet(viewsets.ModelViewSet):
    serializer_class = DespesaSerializer
    search_fields = ['descricao']
    ordering_fields = ['descricao', 'categoria', 'data_vencimento', 'data_pagamento', 'valor', 'status']
    ordering = ['-data_vencimento', '-id']

    def get_queryset(self):
        qs = Despesa.objects.prefetch_related('anexos')
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
        # Gera primeira recorrência ao criar despesa fixa
        if despesa.is_fixed and despesa.recurrence_period:
            despesa.gerar_proxima_recorrencia()
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
        # Gera próxima recorrência quando marcada como paga
        if (status_anterior != 'pago' and despesa.status == 'pago'
                and despesa.is_fixed and despesa.recurrence_period):
            despesa.gerar_proxima_recorrencia()

    @action(detail=True, methods=['delete'], url_path='anexos/(?P<anexo_id>[^/.]+)')
    def remover_anexo(self, request, pk=None, anexo_id=None):
        try:
            anexo = DespesaAnexo.objects.get(pk=anexo_id, despesa_id=pk)
            anexo.arquivo.delete(save=False)
            anexo.delete()
            return Response(status=204)
        except DespesaAnexo.DoesNotExist:
            return Response({'erro': 'Anexo não encontrado.'}, status=404)

    @action(detail=True, methods=['get'], url_path=r'anexos/(?P<anexo_id>\d+)/download')
    def baixar_anexo(self, request, pk=None, anexo_id=None):
        anexo = DespesaAnexo.objects.filter(pk=anexo_id, despesa_id=pk).first()
        if anexo is None or not anexo.arquivo.storage.exists(anexo.arquivo.name):
            return Response({'erro': 'Anexo não encontrado.'}, status=404)
        extensao = os.path.splitext(anexo.arquivo.name)[1].lower()
        resposta = FileResponse(
            anexo.arquivo.open('rb'),
            as_attachment=True,
            filename=anexo.nome_original or os.path.basename(anexo.arquivo.name),
            content_type=TIPOS_PERMITIDOS.get(extensao, 'application/octet-stream'),
        )
        resposta['X-Content-Type-Options'] = 'nosniff'
        return resposta

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        return Response(indicadores.resumo_despesas())

    @action(detail=False, methods=['get'], url_path='por-categoria')
    def por_categoria(self, request):
        return Response(indicadores.gastos_por_categoria())

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


def _anonimizar(nome):
    partes = nome.strip().split()
    if len(partes) == 1:
        return partes[0][0] + '.'
    return f"{partes[0]} {partes[-1][0]}."


@api_view(['GET'])
@permission_classes([AllowAny])
def painel_transparencia(request):
    """Endpoint público — sem dados sensíveis."""
    total_arrecadado = indicadores.total_arrecadado()
    doacoes_mes = indicadores.doacoes_do_mes().aggregate(total=Sum('valor'))['total'] or 0
    apoiadores_ativos = indicadores.membros_ativos().count()

    campanhas = indicadores.campanhas_ativas().com_arrecadado().order_by('-data_inicio')
    campanhas_data = CampanhaSerializer(campanhas, many=True).data

    doacoes_recentes = (
        Doacao.objects
        .select_related('apoiador', 'campanha')
        .filter(status='confirmada')
        .order_by('-data')[:10]
    )
    doacoes_data = [
        {
            'doador': _anonimizar(d.apoiador.nome),
            'campanha': d.campanha.titulo if d.campanha else None,
            'valor': float(d.valor),
            'data': d.data.isoformat(),
        }
        for d in doacoes_recentes
    ]

    gastos_mes_qs = indicadores.despesas_pagas_no_mes()
    a_pagar_mes = indicadores.despesas_a_pagar_no_mes().aggregate(total=Sum('valor'))['total'] or 0
    gastos_mes_total = gastos_mes_qs.aggregate(total=Sum('valor'))['total'] or 0
    gastos_mes_lista = [
        {
            'descricao': d.descricao,
            'categoria': d.get_categoria_display(),
            'valor': float(d.valor),
        }
        for d in gastos_mes_qs.order_by('-valor')
    ]

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
        'doacoes_recentes': doacoes_data,
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
                tipo='config',
                actor_name=actor,
                action_text=acao,
            )
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([DoacaoPublicaThrottle])
def public_doacao(request):
    """Registra uma intenção de doação feita pelo portal público."""
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
