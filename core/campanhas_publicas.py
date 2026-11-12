"""Campanha no portal: dados públicos, imagem, aviso de meta atingida e página de prévia (Open Graph)."""
import json
import os

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.utils.html import escape
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .anexos import TIPOS_PERMITIDOS, validar_anexo
from .models import Campanha, ConfiguracaoInstituicao, ConfiguracaoPix, Notificacao
from .portal import despesas_publicas
from .serializers import CampanhaSerializer, ConfiguracaoPixSerializer

TIPOS_IMAGEM = {ext: tipo for ext, tipo in TIPOS_PERMITIDOS.items() if tipo.startswith('image/')}


def validar_imagem(arquivo):
    """Mesma validação dos anexos (assinatura + 5 MB), mas só imagens."""
    extensao = os.path.splitext(arquivo.name or '')[1].lower()
    if extensao not in TIPOS_IMAGEM:
        raise ValueError('Envie uma imagem JPG, PNG ou WEBP.')
    validar_anexo(arquivo)


def avisar_meta_atingida(campanha):
    """Notifica a equipe uma única vez quando a soma das doações confirmadas alcança a meta."""
    campanha = Campanha.objects.com_arrecadado().get(pk=campanha.pk)
    if campanha.meta_notificada_em or not campanha.meta_atingida:
        return False
    from .views import _notificar_admins

    Campanha.objects.filter(pk=campanha.pk).update(meta_notificada_em=timezone.now())
    _notificar_admins(
        mensagem=f'A campanha {campanha.titulo} atingiu a meta!'[:300],
        tipo='campanha',
        actor_name='Sistema',
        action_text=f'a campanha {campanha.titulo} atingiu a meta'[:200],
        target_type='campanha',
        target_id=campanha.pk,
    )
    return True


def _campanha_visivel(pk):
    """Campanhas pausadas não aparecem no portal; ativas e encerradas sim."""
    return Campanha.objects.com_arrecadado().exclude(status='pausada').filter(pk=pk).first()


def _portal_ativo():
    return ConfiguracaoInstituicao.obter().portal_ativo


@api_view(['GET'])
@permission_classes([AllowAny])
def campanha_publica(request, pk):
    if not _portal_ativo():
        return Response({'erro': 'Portal indisponível.'}, status=404)
    campanha = _campanha_visivel(pk)
    if campanha is None:
        return Response({'erro': 'Campanha não encontrada.'}, status=404)
    despesas = campanha.despesas.filter(status='pago').prefetch_related('anexos').order_by('-data_pagamento')
    return Response({
        **CampanhaSerializer(campanha).data,
        'despesas': despesas_publicas(despesas),
        'pix': ConfiguracaoPixSerializer(ConfiguracaoPix.obter()).data,
        'url_compartilhamento': f'/c/{campanha.pk}/',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def imagem_campanha(request, pk):
    campanha = Campanha.objects.filter(pk=pk).exclude(imagem='').first()
    if campanha is None or not campanha.imagem.storage.exists(campanha.imagem.name):
        return Response({'erro': 'Imagem não encontrada.'}, status=404)
    extensao = os.path.splitext(campanha.imagem.name)[1].lower()
    resposta = FileResponse(campanha.imagem.open('rb'), content_type=TIPOS_IMAGEM.get(extensao, 'application/octet-stream'))
    resposta['X-Content-Type-Options'] = 'nosniff'
    resposta['Cache-Control'] = 'public, max-age=3600'
    return resposta


def pagina_compartilhamento(request, pk):
    """HTML mínimo com Open Graph para a prévia nas redes; o navegador é levado à página React da campanha."""
    campanha = _campanha_visivel(pk) if _portal_ativo() else None
    destino = f"{settings.FRONTEND_URL.rstrip('/')}/transparencia/campanha/{pk}"
    if campanha is None:
        titulo, descricao, imagem = 'Campanha não encontrada', '', ''
    else:
        titulo = campanha.titulo
        arrecadado = f'{campanha.valor_arrecadado:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
        meta = f'{campanha.meta_valor:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')
        descricao = f'Arrecadados R$ {arrecadado} de R$ {meta}. {campanha.descricao[:160]}'.strip()
        imagem = request.build_absolute_uri(f'/api/public/campanhas/{pk}/imagem/') if campanha.imagem else ''
    meta_imagem = f'<meta property="og:image" content="{escape(imagem)}">\n  ' if imagem else ''
    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>{escape(titulo)}</title>
  <meta property="og:type" content="website">
  <meta property="og:title" content="{escape(titulo)}">
  <meta property="og:description" content="{escape(descricao)}">
  <meta property="og:url" content="{escape(destino)}">
  {meta_imagem}<meta name="twitter:card" content="{'summary_large_image' if imagem else 'summary'}">
  <meta http-equiv="refresh" content="0; url={escape(destino)}">
</head>
<body>
  <p>Redirecionando para <a href="{escape(destino)}">{escape(titulo)}</a>…</p>
  <script>window.location.replace({json.dumps(destino)});</script>
</body>
</html>"""
    return HttpResponse(html, status=200 if campanha else 404)
