from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .throttles import AuthThrottle


class TokenStaffSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_staff:
            raise AuthenticationFailed('Conta sem acesso ao painel.', code='sem_acesso_painel')
        return data


class TokenView(TokenObtainPairView):
    serializer_class = TokenStaffSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AuthThrottle]


class RenovarTokenView(TokenRefreshView):
    permission_classes = [AllowAny]


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def logout(request):
    refresh = request.data.get('refresh')
    if not refresh or not isinstance(refresh, str):
        return Response({'erro': 'Refresh token ausente.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        RefreshToken(refresh).blacklist()
    except TokenError:
        return Response({'erro': 'Refresh token inválido ou já encerrado.'}, status=status.HTTP_400_BAD_REQUEST)
    return Response(status=status.HTTP_205_RESET_CONTENT)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def eu(request):
    u = request.user
    return Response({
        'id': u.id,
        'username': u.username,
        'nome': u.get_full_name() or u.username,
        'email': u.email,
        'is_staff': u.is_staff,
        'is_superuser': u.is_superuser,
    })
