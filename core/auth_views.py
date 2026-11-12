from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


class TokenStaffSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        if not self.user.is_staff:
            raise AuthenticationFailed('Conta sem acesso ao painel.', code='sem_acesso_painel')
        return data


class TokenView(TokenObtainPairView):
    serializer_class = TokenStaffSerializer
    permission_classes = [AllowAny]


class RenovarTokenView(TokenRefreshView):
    permission_classes = [AllowAny]


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
