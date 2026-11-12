from django.urls import path
from rest_framework.routers import DefaultRouter

from .campanhas_publicas import campanha_publica, imagem_campanha
from .comunicados import descadastrar
from .equipe import EquipeViewSet
from .voluntarios import AtividadeViewSet, VoluntarioViewSet
from .relatorios import (
    relatorio_apoiadores, relatorio_campanhas, relatorio_despesas, relatorio_doacoes, relatorio_prestacao_contas,
)
from .views import (
    ApoiadorViewSet, CampanhaViewSet, ContribuicaoViewSet, DoacaoViewSet, DashboardViewSet,
    ComunicadoViewSet, NotificacaoViewSet, DespesaViewSet, HistoricoViewSet,
    painel_transparencia, public_doacao, configuracao_pix, configuracao_instituicao, logo_instituicao, instituicao_publica, logo_publico, google_login, prestacao_contas_publica, comprovante_publico,
)

router = DefaultRouter()
router.register(r'apoiadores', ApoiadorViewSet, basename='apoiador')
router.register(r'campanhas', CampanhaViewSet, basename='campanha')
router.register(r'doacoes', DoacaoViewSet, basename='doacao')
router.register(r'contribuicoes', ContribuicaoViewSet, basename='contribuicao')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'comunicados', ComunicadoViewSet, basename='comunicado')
router.register(r'notificacoes', NotificacaoViewSet, basename='notificacao')
router.register(r'despesas', DespesaViewSet, basename='despesa')
router.register(r'historico', HistoricoViewSet, basename='historico')
router.register(r'equipe', EquipeViewSet, basename='equipe')
router.register(r'voluntarios', VoluntarioViewSet, basename='voluntario')
router.register(r'atividades', AtividadeViewSet, basename='atividade')

urlpatterns = router.urls + [
    path('public/transparencia/', painel_transparencia, name='painel_transparencia'),
    path('public/doacoes/', public_doacao, name='public_doacao'),
    path('public/prestacao-contas/', prestacao_contas_publica, name='prestacao_contas_publica'),
    path('public/campanhas/<int:pk>/', campanha_publica, name='campanha_publica'),
    path('public/campanhas/<int:pk>/imagem/', imagem_campanha, name='imagem_campanha'),
    path('public/despesas/<int:despesa_id>/comprovantes/<int:anexo_id>/', comprovante_publico, name='comprovante_publico'),
    path('configuracoes/pix/', configuracao_pix, name='configuracao_pix'),
    path('configuracoes/instituicao/', configuracao_instituicao, name='configuracao_instituicao'),
    path('configuracoes/instituicao/logo/', logo_instituicao, name='logo_instituicao'),
    path('public/instituicao/', instituicao_publica, name='instituicao_publica'),
    path('public/descadastrar/<str:token>/', descadastrar, name='descadastrar'),
    path('public/instituicao/logo/', logo_publico, name='logo_publico'),
    path('auth/google/', google_login, name='google_login'),
    path('relatorios/doacoes/', relatorio_doacoes, name='relatorio_doacoes'),
    path('relatorios/campanhas/', relatorio_campanhas, name='relatorio_campanhas'),
    path('relatorios/apoiadores/', relatorio_apoiadores, name='relatorio_apoiadores'),
    path('relatorios/despesas/', relatorio_despesas, name='relatorio_despesas'),
    path('relatorios/prestacao-contas/', relatorio_prestacao_contas, name='relatorio_prestacao_contas'),
]
