from django.contrib import admin
from django.urls import path, include
from core.auth_views import TokenView, RenovarTokenView, alterar_senha, eu, logout
from core.campanhas_publicas import pagina_compartilhamento
from core.equipe import ativar_convite

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', RenovarTokenView.as_view(), name='token_refresh'),
    path('api/auth/me/', eu, name='auth_me'),
    path('api/auth/logout/', logout, name='auth_logout'),
    path('api/auth/alterar-senha/', alterar_senha, name='auth_alterar_senha'),
    path('api/auth/ativar-convite/', ativar_convite, name='auth_ativar_convite'),
    path('api/', include('core.urls')),
    path('c/<int:pk>/', pagina_compartilhamento, name='compartilhar_campanha'),
]
