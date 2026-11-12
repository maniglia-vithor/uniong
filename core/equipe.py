"""Equipe do painel: convite por e-mail, ativação pelo link e gestão de acessos (só superusuário)."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.utils.crypto import constant_time_compare
from django.utils.encoding import force_bytes, force_str
from django.utils.http import base36_to_int, urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response

from .auditoria import registrar
from .normalizacao import normalizar_email
from .throttles import AuthThrottle

Usuario = get_user_model()


class ConviteTokenGenerator(PasswordResetTokenGenerator):
    """Como o token de redefinição de senha, mas com sal próprio e validade de CONVITE_VALIDADE_SEGUNDOS."""

    key_salt = 'core.equipe.ConviteTokenGenerator'

    def check_token(self, user, token):
        if not (user and token) or '-' not in token:
            return False
        ts_b36 = token.split('-')[0]
        try:
            ts = base36_to_int(ts_b36)
        except ValueError:
            return False
        segredos = [self.secret, *self.secret_fallbacks]
        if not any(constant_time_compare(self._make_token_with_timestamp(user, ts, s), token) for s in segredos):
            return False
        return (self._num_seconds(self._now()) - ts) <= settings.CONVITE_VALIDADE_SEGUNDOS


convite_token = ConviteTokenGenerator()


def link_com_token(caminho, usuario, gerador):
    uid = urlsafe_base64_encode(force_bytes(usuario.pk))
    return f"{settings.FRONTEND_URL.rstrip('/')}/{caminho}/{uid}/{gerador.make_token(usuario)}"


def usuario_do_link(uidb64, token, gerador):
    try:
        usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
        return None
    return usuario if gerador.check_token(usuario, token) else None


def enviar_convite(usuario, convidado_por):
    link = link_com_token('definir-senha', usuario, convite_token)
    quem = convidado_por.get_full_name() or convidado_por.username
    send_mail(
        subject='Convite para o painel da organização',
        message=(
            f'Olá, {usuario.first_name or usuario.email}!\n\n'
            f'{quem} convidou você para acessar o painel administrativo.\n'
            f'Defina sua senha neste link (válido por 72 horas):\n{link}\n\n'
            'Se você não esperava este convite, ignore esta mensagem.'
        ),
        from_email=None,
        recipient_list=[usuario.email],
    )


class SomenteSuperusuario(BasePermission):
    message = 'Apenas superusuários podem gerenciar a equipe.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_active and request.user.is_superuser)


class MembroEquipeSerializer(serializers.ModelSerializer):
    nome = serializers.SerializerMethodField()
    convite_pendente = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'nome', 'email', 'is_active', 'is_superuser', 'last_login', 'convite_pendente']

    def get_nome(self, u):
        return u.get_full_name() or u.username

    def get_convite_pendente(self, u):
        return not u.is_active and not u.has_usable_password()


class ConviteSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    superusuario = serializers.BooleanField(default=False)

    def validate_email(self, value):
        email = normalizar_email(value)
        if Usuario.objects.filter(email__iexact=email).exists() or Usuario.objects.filter(username__iexact=email).exists():
            raise serializers.ValidationError('Já existe um usuário com este e-mail.')
        return email


def _superusuarios_ativos_alem(usuario):
    return Usuario.objects.filter(is_superuser=True, is_active=True).exclude(pk=usuario.pk).exists()


class EquipeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MembroEquipeSerializer
    permission_classes = [SomenteSuperusuario]
    search_fields = ['first_name', 'last_name', 'email', 'username']
    ordering_fields = ['first_name', 'email', 'last_login']
    ordering = ['-is_active', 'first_name', 'id']

    def get_queryset(self):
        return Usuario.objects.filter(is_staff=True)

    @action(detail=False, methods=['post'])
    def convidar(self, request):
        serializer = ConviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        partes = dados['nome'].strip().split(' ', 1)
        with transaction.atomic():
            usuario = Usuario(
                username=dados['email'], email=dados['email'], first_name=partes[0][:150],
                last_name=partes[1][:150] if len(partes) > 1 else '',
                is_staff=True, is_superuser=dados['superusuario'], is_active=False,
            )
            usuario.set_unusable_password()
            usuario.save()
            registrar(request.user, usuario, 'criacao', depois=f'convite para {usuario.email}')
        enviar_convite(usuario, request.user)
        return Response(MembroEquipeSerializer(usuario).data, status=201)

    @action(detail=True, methods=['post'], url_path='reenviar-convite')
    def reenviar_convite(self, request, pk=None):
        usuario = self.get_object()
        if usuario.is_active or usuario.has_usable_password():
            return Response({'erro': 'Este usuário já ativou o acesso.'}, status=400)
        enviar_convite(usuario, request.user)
        return Response({'mensagem': 'Convite reenviado.'})

    @action(detail=True, methods=['patch'], url_path='acesso')
    def acesso(self, request, pk=None):
        """PATCH {is_active?, is_superuser?}: desativa/reativa ou define administrador geral × operador."""
        usuario = self.get_object()
        mudancas = {campo: request.data[campo] for campo in ('is_active', 'is_superuser') if campo in request.data}
        if any(not isinstance(v, bool) for v in mudancas.values()):
            return Response({'erro': 'Use true ou false.'}, status=400)
        perde_super = (
            usuario.is_superuser and usuario.is_active
            and (mudancas.get('is_active') is False or mudancas.get('is_superuser') is False)
        )
        if perde_super and not _superusuarios_ativos_alem(usuario):
            return Response({'erro': 'É preciso manter ao menos um administrador geral ativo.'}, status=400)
        if mudancas.get('is_active') is True and not usuario.has_usable_password():
            return Response({'erro': 'O usuário ainda não definiu a senha pelo convite.'}, status=400)
        for campo, valor in mudancas.items():
            if getattr(usuario, campo) != valor:
                registrar(request.user, usuario, 'edicao', campo, str(getattr(usuario, campo)), str(valor))
                setattr(usuario, campo, valor)
        usuario.save(update_fields=list(mudancas) or None)
        return Response(MembroEquipeSerializer(usuario).data)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def ativar_convite(request):
    """Define a senha pelo link do convite e ativa o usuário."""
    usuario = usuario_do_link(request.data.get('uid', ''), request.data.get('token', ''), convite_token)
    if usuario is None or usuario.is_active:
        return Response({'erro': 'Link inválido ou expirado. Peça um novo convite.'}, status=400)
    senha = request.data.get('senha') or ''
    try:
        validate_password(senha, usuario)
    except DjangoValidationError as e:
        return Response({'senha': list(e.messages)}, status=400)
    usuario.set_password(senha)
    usuario.is_active = True
    usuario.save(update_fields=['password', 'is_active'])
    return Response({'mensagem': 'Acesso ativado. Você já pode entrar no painel.'})
