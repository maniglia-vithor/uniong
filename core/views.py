import csv
from datetime import date

from django.conf import settings
from django.contrib.auth import get_user_model
from google.oauth2 import id_token as google_id_token
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from rest_framework_simplejwt.tokens import RefreshToken
from dateutil.relativedelta import relativedelta
from django.db.models import Sum, Q
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from .models import Apoiador, Campanha, Doacao, Comunicado, Notificacao, Despesa, DespesaAnexo, ConfiguracaoPix
from .serializers import ApoiadorSerializer, CampanhaSerializer, DoacaoSerializer, ComunicadoSerializer, NotificacaoSerializer, DespesaSerializer, DespesaAnexoSerializer, ConfiguracaoPixSerializer


def _notificar_admins(mensagem, tipo, actor_name='', action_text='', target_type='', target_id=None):
    User = get_user_model()
    admins = User.objects.filter(is_staff=True)
    if not admins.exists():
        admins = User.objects.all()
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


class ApoiadorViewSet(viewsets.ModelViewSet):
    queryset = Apoiador.objects.all()
    serializer_class = ApoiadorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

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


class CampanhaViewSet(viewsets.ModelViewSet):
    queryset = Campanha.objects.all()
    serializer_class = CampanhaSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs

    def perform_create(self, serializer):
        campanha = serializer.save()
        actor = self.request.user.get_full_name() or self.request.user.username
        meta = f'R$ {campanha.meta:.2f}'.replace('.', ',') if campanha.meta else None
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
    queryset = Doacao.objects.select_related('apoiador', 'campanha').all()
    serializer_class = DoacaoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        campanha = self.request.query_params.get('campanha')
        apoiador = self.request.query_params.get('apoiador')
        if status:
            qs = qs.filter(status=status)
        if campanha:
            qs = qs.filter(campanha_id=campanha)
        if apoiador:
            qs = qs.filter(apoiador_id=apoiador)
        return qs

    def perform_create(self, serializer):
        doacao = serializer.save()
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
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return Notificacao.objects.filter(usuario=self.request.user)

    @action(detail=False, methods=['post'], url_path='marcar-todas-lidas')
    def marcar_todas_lidas(self, request):
        Notificacao.objects.filter(usuario=request.user, lida=False).update(lida=True)
        return Response({'ok': True})


class DashboardViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        hoje = date.today()
        inicio_mes_atual = hoje.replace(day=1)
        inicio_mes_anterior = (inicio_mes_atual - relativedelta(months=1))
        fim_mes_anterior = inicio_mes_atual

        def calcular_trend(atual, anterior):
            if anterior == 0:
                pct = 100.0 if atual > 0 else 0.0
            else:
                pct = round(((atual - anterior) / anterior) * 100, 1)
            if pct > 0:
                direction = 'positive'
            elif pct < 0:
                direction = 'negative'
            else:
                direction = 'neutral'
            return pct, direction

        total_arrecadado = Doacao.objects.filter(status='confirmada').aggregate(
            total=Sum('valor')
        )['total'] or 0
        total_anterior = Doacao.objects.filter(
            status='confirmada', data__lt=inicio_mes_atual
        ).aggregate(total=Sum('valor'))['total'] or 0
        total_trend, total_direction = calcular_trend(float(total_arrecadado), float(total_anterior))

        doacoes_mes = Doacao.objects.filter(
            status='confirmada', data__gte=inicio_mes_atual
        ).aggregate(total=Sum('valor'))['total'] or 0
        doacoes_mes_anterior = Doacao.objects.filter(
            status='confirmada', data__gte=inicio_mes_anterior, data__lt=fim_mes_anterior
        ).aggregate(total=Sum('valor'))['total'] or 0
        doacoes_trend, doacoes_direction = calcular_trend(float(doacoes_mes), float(doacoes_mes_anterior))

        apoiadores_ativos = Apoiador.objects.filter(status='ativo').count()
        apoiadores_anterior = Apoiador.objects.filter(
            status='ativo', data_cadastro__lt=inicio_mes_atual
        ).count()
        apoiadores_trend, apoiadores_direction = calcular_trend(apoiadores_ativos, apoiadores_anterior)

        campanhas_ativas = Campanha.objects.filter(status='ativa').count()
        campanhas_anterior = Campanha.objects.filter(
            status='ativa', data_inicio__lt=inicio_mes_atual
        ).count()
        campanhas_trend, campanhas_direction = calcular_trend(campanhas_ativas, campanhas_anterior)

        return Response({
            'total_arrecadado': {
                'value': float(total_arrecadado),
                'trend_percentage': total_trend,
                'trend_direction': total_direction,
            },
            'doacoes_mes': {
                'value': float(doacoes_mes),
                'trend_percentage': doacoes_trend,
                'trend_direction': doacoes_direction,
            },
            'apoiadores_ativos': {
                'value': apoiadores_ativos,
                'trend_percentage': apoiadores_trend,
                'trend_direction': apoiadores_direction,
            },
            'campanhas_ativas': {
                'value': campanhas_ativas,
                'trend_percentage': campanhas_trend,
                'trend_direction': campanhas_direction,
            },
        })

    @action(detail=False, methods=['get'], url_path='grafico-mensal')
    def grafico_mensal(self, request):
        hoje = date.today()
        meses = []

        MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

        for i in range(11, -1, -1):
            inicio = (hoje - relativedelta(months=i)).replace(day=1)
            fim = (inicio + relativedelta(months=1))
            total = Doacao.objects.filter(
                status='confirmada',
                data__gte=inicio,
                data__lt=fim,
            ).aggregate(total=Sum('valor'))['total'] or 0

            meses.append({
                'mes': f"{MESES_PT[inicio.month - 1]}/{inicio.strftime('%y')}",
                'isoMes': inicio.strftime('%Y-%m'),
                'total': float(total),
            })

        return Response(meses)

    @action(detail=False, methods=['get'], url_path='doacoes-recentes')
    def doacoes_recentes(self, request):
        doacoes = Doacao.objects.select_related('apoiador', 'campanha').order_by('-data')[:10]
        serializer = DoacaoSerializer(doacoes, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='top-apoiadores')
    def top_apoiadores(self, request):
        top = (
            Apoiador.objects
            .filter(doacoes__status='confirmada')
            .annotate(total_doado=Sum('doacoes__valor'))
            .order_by('-total_doado')[:5]
        )
        data = [
            {'id': a.id, 'nome': a.nome, 'total_doado': float(a.total_doado or 0)}
            for a in top
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='campanhas-ativas')
    def campanhas_ativas(self, request):
        campanhas = Campanha.objects.filter(status='ativa').order_by('-data_inicio')
        serializer = CampanhaSerializer(campanhas, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='kpi-doacoes')
    def kpi_doacoes(self, request):
        doacoes = (
            Doacao.objects
            .select_related('apoiador', 'campanha')
            .filter(status='confirmada')
            .order_by('-data')
        )
        data = [
            {
                'id': d.id,
                'apoiador_nome': d.apoiador.nome,
                'valor': float(d.valor),
                'data': d.data.isoformat(),
            }
            for d in doacoes
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='doacoes-por-mes')
    def doacoes_por_mes(self, request):
        """Retorna doações confirmadas de um mês específico (formato: YYYY-MM)."""
        mes_param = request.query_params.get('mes')
        if not mes_param:
            return Response({'erro': 'Parâmetro "mes" obrigatório (ex: 2026-11).'}, status=400)
        try:
            ano, mes = int(mes_param.split('-')[0]), int(mes_param.split('-')[1])
        except (ValueError, IndexError):
            return Response({'erro': 'Formato inválido. Use YYYY-MM.'}, status=400)

        inicio = date(ano, mes, 1)
        fim = inicio + relativedelta(months=1)
        doacoes = (
            Doacao.objects
            .select_related('apoiador', 'campanha')
            .filter(status='confirmada', data__gte=inicio, data__lt=fim)
            .order_by('-data')
        )
        data = [
            {
                'id': d.id,
                'apoiador_nome': d.apoiador.nome,
                'valor': float(d.valor),
                'data': d.data.isoformat(),
                'campanha': d.campanha.titulo if d.campanha else None,
            }
            for d in doacoes
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='kpi-doacoes-mes')
    def kpi_doacoes_mes(self, request):
        inicio_mes = date.today().replace(day=1)
        doacoes = (
            Doacao.objects
            .select_related('apoiador', 'campanha')
            .filter(status='confirmada', data__gte=inicio_mes)
            .order_by('-data')
        )
        data = [
            {
                'id': d.id,
                'apoiador_nome': d.apoiador.nome,
                'valor': float(d.valor),
                'data': d.data.isoformat(),
                'campanha': d.campanha.titulo if d.campanha else None,
            }
            for d in doacoes
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='kpi-apoiadores-ativos')
    def kpi_apoiadores_ativos(self, request):
        apoiadores = Apoiador.objects.filter(status='ativo').order_by('nome')
        data = [
            {
                'id': a.id,
                'nome': a.nome,
                'email': a.email,
                'data_cadastro': a.data_cadastro.isoformat(),
            }
            for a in apoiadores
        ]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='kpi-campanhas-ativas')
    def kpi_campanhas_ativas(self, request):
        campanhas = Campanha.objects.filter(status='ativa').order_by('-data_inicio')
        data = [
            {
                'id': c.id,
                'titulo': c.titulo,
                'data_inicio': c.data_inicio.isoformat(),
                'data_fim': c.data_fim.isoformat() if c.data_fim else None,
                'meta_valor': float(c.meta_valor),
                'valor_arrecadado': float(c.valor_arrecadado),
            }
            for c in campanhas
        ]
        return Response(data)


class DespesaViewSet(viewsets.ModelViewSet):
    queryset = Despesa.objects.prefetch_related('anexos').all()
    serializer_class = DespesaSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get('status')
        categoria = self.request.query_params.get('categoria')
        if status:
            qs = qs.filter(status=status)
        if categoria:
            qs = qs.filter(categoria=categoria)
        return qs

    def _salvar_anexos(self, despesa, arquivos):
        for arq in arquivos:
            import os
            anexo = DespesaAnexo(despesa=despesa, nome_original=arq.name)
            anexo.arquivo = arq
            anexo.save()

    def perform_create(self, serializer):
        despesa = serializer.save()
        arquivos = self.request.FILES.getlist('anexos')
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
        status_anterior = serializer.instance.status
        despesa = serializer.save()
        arquivos = self.request.FILES.getlist('anexos')
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

    @action(detail=False, methods=['get'], url_path='resumo')
    def resumo(self, request):
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)
        fim_mes = inicio_mes + relativedelta(months=1)

        todas = Despesa.objects.all()

        gasto_mes = todas.filter(
            data_vencimento__gte=inicio_mes, data_vencimento__lt=fim_mes
        ).aggregate(total=Sum('valor'))['total'] or 0

        # Pendentes consideram status_efetivo, então incluímos 'pendente' e 'atrasado'
        total_pendente = todas.filter(
            status__in=['pendente', 'atrasado']
        ).aggregate(total=Sum('valor'))['total'] or 0

        # Maior categoria do mês
        from django.db.models import Sum as DjSum
        por_categoria = (
            todas
            .filter(data_vencimento__gte=inicio_mes, data_vencimento__lt=fim_mes)
            .values('categoria')
            .annotate(total=DjSum('valor'))
            .order_by('-total')
        )
        maior_categoria = por_categoria[0]['categoria'] if por_categoria else None
        maior_categoria_display = dict(Despesa.CATEGORIA_CHOICES).get(maior_categoria, '—')

        return Response({
            'gasto_mes': float(gasto_mes),
            'total_pendente': float(total_pendente),
            'maior_categoria': maior_categoria,
            'maior_categoria_display': maior_categoria_display,
        })

    @action(detail=False, methods=['get'], url_path='por-categoria')
    def por_categoria(self, request):
        hoje = date.today()
        inicio_mes = hoje.replace(day=1)
        fim_mes = inicio_mes + relativedelta(months=1)

        dados = (
            Despesa.objects
            .filter(data_vencimento__gte=inicio_mes, data_vencimento__lt=fim_mes)
            .values('categoria')
            .annotate(total=Sum('valor'))
            .order_by('-total')
        )
        label_map = dict(Despesa.CATEGORIA_CHOICES)
        return Response([
            {'categoria': d['categoria'], 'label': label_map.get(d['categoria'], d['categoria']), 'total': float(d['total'])}
            for d in dados
        ])


class ComunicadoViewSet(viewsets.ModelViewSet):
    queryset = Comunicado.objects.all()
    serializer_class = ComunicadoSerializer
    permission_classes = [IsAuthenticated]


def _csv_response(filename):
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('﻿')  # BOM para compatibilidade com Excel
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def relatorio_doacoes(request):
    response = _csv_response('relatorio_doacoes.csv')
    writer = csv.writer(response)
    writer.writerow(['ID', 'Apoiador', 'Campanha', 'Valor (R$)', 'Data', 'Status'])
    for d in Doacao.objects.select_related('apoiador', 'campanha').order_by('-data'):
        writer.writerow([
            d.id,
            d.apoiador.nome,
            d.campanha.titulo if d.campanha else '',
            str(d.valor).replace('.', ','),
            d.data.strftime('%d/%m/%Y'),
            d.get_status_display(),
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def relatorio_campanhas(request):
    response = _csv_response('relatorio_campanhas.csv')
    writer = csv.writer(response)
    writer.writerow(['ID', 'Título', 'Meta (R$)', 'Arrecadado (R$)', 'Progresso (%)', 'Status', 'Início', 'Fim'])
    for c in Campanha.objects.order_by('-data_inicio'):
        writer.writerow([
            c.id,
            c.titulo,
            str(c.meta_valor).replace('.', ','),
            str(c.valor_arrecadado).replace('.', ','),
            c.percentual_progresso,
            c.get_status_display(),
            c.data_inicio.strftime('%d/%m/%Y'),
            c.data_fim.strftime('%d/%m/%Y') if c.data_fim else '',
        ])
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def relatorio_apoiadores(request):
    response = _csv_response('relatorio_apoiadores.csv')
    writer = csv.writer(response)
    writer.writerow(['ID', 'Nome', 'E-mail', 'Data de Cadastro', 'Status', 'Total Doado (R$)'])
    apoiadores = (
        Apoiador.objects
        .annotate(total_doado=Sum('doacoes__valor', filter=Q(doacoes__status='confirmada')))
        .order_by('nome')
    )
    for a in apoiadores:
        writer.writerow([
            a.id,
            a.nome,
            a.email,
            a.data_cadastro.strftime('%d/%m/%Y'),
            a.get_status_display(),
            str(a.total_doado or 0).replace('.', ','),
        ])
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
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
    hoje = date.today()
    inicio_mes = hoje.replace(day=1)

    total_arrecadado = Doacao.objects.filter(status='confirmada').aggregate(
        total=Sum('valor')
    )['total'] or 0

    doacoes_mes = Doacao.objects.filter(
        status='confirmada', data__gte=inicio_mes
    ).aggregate(total=Sum('valor'))['total'] or 0

    apoiadores_ativos = Apoiador.objects.filter(status='ativo').count()

    campanhas = Campanha.objects.filter(status='ativa').order_by('-data_inicio')
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

    gastos_mes_qs = Despesa.objects.filter(
        data_vencimento__gte=inicio_mes,
        data_vencimento__lt=inicio_mes + relativedelta(months=1),
    )
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


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def configuracao_pix(request):
    config = ConfiguracaoPix.obter()
    if request.method == 'PUT':
        serializer = ConfiguracaoPixSerializer(config, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
    return Response(ConfiguracaoPixSerializer(config).data)


@api_view(['POST'])
@permission_classes([AllowAny])
def public_doacao(request):
    """Endpoint público para registrar intenção de doação."""
    nome = request.data.get('nome', '').strip()
    email = request.data.get('email', '').strip()
    celular = request.data.get('celular', '').strip()
    campaign_id = request.data.get('campaign_id')
    valor = request.data.get('valor', 0)

    if not nome or not email:
        return Response({'erro': 'Nome e e-mail são obrigatórios.'}, status=400)

    apoiador, _ = Apoiador.objects.get_or_create(
        email=email,
        defaults={'nome': nome, 'celular': celular or None, 'status': 'ativo'},
    )
    if celular and not apoiador.celular:
        apoiador.celular = celular
        apoiador.save(update_fields=['celular'])

    campanha = None
    if campaign_id:
        try:
            campanha = Campanha.objects.get(pk=campaign_id)
        except Campanha.DoesNotExist:
            pass

    try:
        valor_decimal = float(valor) if valor else 0
    except (ValueError, TypeError):
        valor_decimal = 0

    Doacao.objects.create(
        apoiador=apoiador,
        campanha=campanha,
        valor=max(valor_decimal, 0.01),
        data=date.today(),
        status='pendente',
    )

    return Response({'mensagem': 'Doação registrada com sucesso! Aguarde confirmação.'}, status=201)
