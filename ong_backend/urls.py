from django.contrib import admin
from django.urls import path, include
from core.auth_views import TokenView, RenovarTokenView, eu, logout

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', RenovarTokenView.as_view(), name='token_refresh'),
    path('api/auth/me/', eu, name='auth_me'),
    path('api/auth/logout/', logout, name='auth_logout'),
    path('api/', include('core.urls')),
]
