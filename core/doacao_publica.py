from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from .models import Apoiador, Campanha
from .normalizacao import normalizar_celular, normalizar_email

VALOR_MINIMO = Decimal('1.00')
VALOR_MAXIMO = Decimal('100000.00')


class DoacaoPublicaSerializer(serializers.Serializer):
    nome = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField()
    celular = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    campaign_id = serializers.IntegerField(required=False, allow_null=True)
    valor = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=VALOR_MINIMO, max_value=VALOR_MAXIMO,
        error_messages={
            'min_value': 'O valor mínimo é R$ 1,00.',
            'max_value': 'O valor máximo é R$ 100.000,00.',
        },
    )
    consentimento = serializers.BooleanField()
    # Campo isca: invisível para pessoas; robôs costumam preenchê-lo.
    site = serializers.CharField(required=False, allow_blank=True)

    def validate_email(self, value):
        return normalizar_email(value)

    def validate_celular(self, value):
        try:
            return normalizar_celular(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))

    def validate_campaign_id(self, value):
        if value is None:
            return None
        campanha = Campanha.objects.em_andamento().filter(pk=value).first()
        if campanha is None:
            raise serializers.ValidationError('Campanha indisponível para doações.')
        return campanha

    def validate_consentimento(self, value):
        if not value:
            raise serializers.ValidationError('É preciso aceitar a política de privacidade.')
        return value


def registrar_doacao_publica(dados):
    """Cria (ou reaproveita, sem alterar) o membro e a doação pendente de origem 'portal'."""
    from .models import Doacao

    apoiador = Apoiador.objects.filter(email__iexact=dados['email']).first()
    if apoiador is None:
        apoiador = Apoiador.objects.create(
            nome=dados['nome'], email=dados['email'], celular=dados.get('celular'), status='interessado',
        )
    return Doacao.objects.create(
        apoiador=apoiador,
        campanha=dados.get('campaign_id'),
        valor=dados['valor'],
        data=timezone.localdate(),
        status='pendente',
        origem='portal',
        consentimento_em=timezone.now(),
    )


def ativar_membro_interessado(doacao):
    """Na confirmação de uma doação, o membro 'interessado' passa a 'ativo'."""
    if doacao.status == 'confirmada' and doacao.apoiador_id and doacao.apoiador.status == 'interessado':
        doacao.apoiador.status = 'ativo'
        doacao.apoiador.save(update_fields=['status'])
