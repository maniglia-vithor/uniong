from django.urls import path
from rest_framework.routers import DefaultRouter

from .relatorios import relatorio_apoiadores, relatorio_campanhas, relatorio_doacoes
from .views import (
    ApoiadorViewSet, CampanhaViewSet, DoacaoViewSet, DashboardViewSet,
    ComunicadoViewSet, NotificacaoViewSet, DespesaViewSet,
    painel_transparencia, public_doacao, configuracao_pix, configuracao_instituicao, google_login,
)

router = DefaultRouter()
router.register(r'apoiadores', ApoiadorViewSet, basename='apoiador')
router.register(r'campanhas', CampanhaViewSet, basename='campanha')
router.register(r'doacoes', DoacaoViewSet, basename='doacao')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'comunicados', ComunicadoViewSet, basename='comunicado')
router.register(r'notificacoes', NotificacaoViewSet, basename='notificacao')
router.register(r'despesas', DespesaViewSet, basename='despesa')

urlpatterns = router.urls + [
    path('public/transparencia/', painel_transparencia, name='painel_transparencia'),
    path('public/doacoes/', public_doacao, name='public_doacao'),
    path('configuracoes/pix/', configuracao_pix, name='configuracao_pix'),
    path('configuracoes/instituicao/', configuracao_instituicao, name='configuracao_instituicao'),
    path('auth/google/', google_login, name='google_login'),
    path('relatorios/doacoes/', relatorio_doacoes, name='relatorio_doacoes'),
    path('relatorios/campanhas/', relatorio_campanhas, name='relatorio_campanhas'),
    path('relatorios/apoiadores/', relatorio_apoiadores, name='relatorio_apoiadores'),
]
