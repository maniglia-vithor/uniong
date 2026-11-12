from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .normalizacao import normalizar_email
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


def _dados_usuario(u):
    return {
        'id': u.id,
        'username': u.username,
        'nome': u.get_full_name() or u.username,
        'email': u.email,
        'is_staff': u.is_staff,
        'is_superuser': u.is_superuser,
    }


class PerfilSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150, required=False, allow_blank=False)
    email = serializers.EmailField(required=False)

    def validate_email(self, value):
        email = normalizar_email(value)
        usuario = self.context['request'].user
        if get_user_model().objects.filter(email__iexact=email).exclude(pk=usuario.pk).exists():
            raise serializers.ValidationError('Este e-mail já está em uso por outro usuário.')
        return email


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def eu(request):
    u = request.user
    if request.method == 'PATCH':
        serializer = PerfilSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        if 'nome' in dados:
            partes = dados['nome'].strip().split(' ', 1)
            u.first_name = partes[0][:150]
            u.last_name = partes[1][:150] if len(partes) > 1 else ''
        if 'email' in dados:
            u.email = dados['email']
        u.save(update_fields=['first_name', 'last_name', 'email'])
    return Response(_dados_usuario(u))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@throttle_classes([AuthThrottle])
def alterar_senha(request):
    u = request.user
    atual = request.data.get('senha_atual') or ''
    nova = request.data.get('nova_senha') or ''
    if not u.check_password(atual):
        return Response({'senha_atual': ['Senha atual incorreta.']}, status=400)
    try:
        validate_password(nova, u)
    except DjangoValidationError as e:
        return Response({'nova_senha': list(e.messages)}, status=400)
    u.set_password(nova)
    u.save(update_fields=['password'])
    return Response({'mensagem': 'Senha alterada com sucesso.'})
