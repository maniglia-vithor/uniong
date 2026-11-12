from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers
from .models import Apoiador, Campanha, Doacao, Comunicado, Notificacao, Despesa, DespesaAnexo, ConfiguracaoInstituicao, ConfiguracaoPix, LogAlteracao
from .normalizacao import normalizar_celular, normalizar_email
from .pix import normalizar_chave_pix


class LogAlteracaoSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.SerializerMethodField()
    acao_display = serializers.CharField(source='get_acao_display', read_only=True)

    class Meta:
        model = LogAlteracao
        fields = ['id', 'data', 'usuario', 'usuario_nome', 'acao', 'acao_display', 'modelo', 'objeto_id', 'campo', 'antes', 'depois']

    def get_usuario_nome(self, obj):
        if obj.usuario is None:
            return 'Sistema'
        return obj.usuario.get_full_name() or obj.usuario.username


class ConfiguracaoInstituicaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoInstituicao
        fields = ['portal_ativo']


class ConfiguracaoPixSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoPix
        fields = ['chave', 'nome_recebedor', 'cidade']

    def validate_chave(self, value):
        try:
            chave, _tipo = normalizar_chave_pix(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))
        return chave

    def validate_nome_recebedor(self, value):
        return value.strip()

    def validate_cidade(self, value):
        return value.strip()


def _positivo(valor, mensagem):
    if valor is None or valor <= 0:
        raise serializers.ValidationError(mensagem)
    return valor


class ApoiadorSerializer(serializers.ModelSerializer):
    total_doado = serializers.SerializerMethodField()

    class Meta:
        model = Apoiador
        fields = ['id', 'nome', 'email', 'celular', 'data_cadastro', 'status', 'total_doado']

    def get_total_doado(self, obj):
        total = getattr(obj, 'total_doado', None)
        if total is None:
            total = obj.doacoes.filter(status='confirmada').aggregate(total=Sum('valor'))['total']
        return float(total) if total else 0.0

    def validate_email(self, value):
        email = normalizar_email(value)
        repetido = Apoiador.objects.filter(email__iexact=email)
        if self.instance is not None:
            repetido = repetido.exclude(pk=self.instance.pk)
        if repetido.exists():
            raise serializers.ValidationError('Já existe um membro com este e-mail.')
        return email

    def validate_celular(self, value):
        try:
            return normalizar_celular(value)
        except ValueError as e:
            raise serializers.ValidationError(str(e))


class CampanhaSerializer(serializers.ModelSerializer):
    valor_arrecadado = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    percentual_progresso = serializers.ReadOnlyField()
    meta_atingida = serializers.ReadOnlyField()
    valor_gasto = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    saldo = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Campanha
        fields = [
            'id', 'titulo', 'meta_valor', 'valor_arrecadado', 'percentual_progresso',
            'meta_atingida', 'valor_gasto', 'saldo', 'status', 'data_inicio', 'data_fim', 'descricao',
        ]

    def validate_meta_valor(self, value):
        return _positivo(value, 'A meta deve ser maior que zero.')

    def validate(self, attrs):
        inicio = attrs.get('data_inicio', getattr(self.instance, 'data_inicio', None))
        fim = attrs.get('data_fim', getattr(self.instance, 'data_fim', None))
        if inicio and fim and fim < inicio:
            raise serializers.ValidationError({'data_fim': 'O encerramento não pode ser anterior ao início.'})
        return attrs


class ComunicadoSerializer(serializers.ModelSerializer):
    publico_alvo_display = serializers.CharField(source='get_publico_alvo_display', read_only=True)

    class Meta:
        model = Comunicado
        fields = ['id', 'titulo', 'conteudo', 'data_publicacao', 'publico_alvo', 'publico_alvo_display']
        read_only_fields = ['data_publicacao']


class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = ['id', 'mensagem', 'tipo', 'lida', 'criada_em', 'actor_name', 'action_text', 'target_type', 'target_id']
        read_only_fields = ['criada_em']


class DespesaAnexoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = DespesaAnexo
        fields = ['id', 'nome_original', 'url', 'enviado_em', 'publico']
        read_only_fields = ['publico']

    def get_url(self, obj):
        return f'/api/despesas/{obj.despesa_id}/anexos/{obj.id}/download/'


class DespesaSerializer(serializers.ModelSerializer):
    status_efetivo = serializers.SerializerMethodField()
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    recurrence_period_display = serializers.CharField(
        source='get_recurrence_period_display', read_only=True, default=None
    )
    anexos = DespesaAnexoSerializer(many=True, read_only=True)
    campanha_titulo = serializers.CharField(source='campanha.titulo', read_only=True, default=None)

    class Meta:
        model = Despesa
        fields = [
            'id', 'descricao', 'descricao_publica', 'campanha', 'campanha_titulo', 'valor', 'data_vencimento', 'data_pagamento',
            'categoria', 'categoria_display', 'status', 'status_efetivo',
            'is_fixed', 'recurrence_period', 'recurrence_period_display', 'anexos',
            'serie_id', 'data_ancora', 'numero_ocorrencia', 'recorrencia_fim',
        ]
        read_only_fields = ['serie_id', 'data_ancora', 'numero_ocorrencia']

    def get_status_efetivo(self, obj):
        return obj.status_efetivo()

    def validate_valor(self, value):
        return _positivo(value, 'O valor deve ser maior que zero.')

    def validate(self, attrs):
        status = attrs.get('status', getattr(self.instance, 'status', None))
        status_anterior = getattr(self.instance, 'status', None)
        pagamento = attrs.get('data_pagamento', getattr(self.instance, 'data_pagamento', None))
        if status == 'pago' and not pagamento:
            attrs['data_pagamento'] = timezone.localdate()
        if status_anterior == 'pago' and status != 'pago':
            # Voltar de "pago" não apaga nada, mas a data de pagamento deixa de valer.
            attrs['data_pagamento'] = None
        if attrs.get('is_fixed') is False:
            attrs['recurrence_period'] = None
        return attrs


class DoacaoSerializer(serializers.ModelSerializer):
    apoiador_nome = serializers.CharField(source='apoiador.nome', read_only=True)
    campanha_titulo = serializers.CharField(source='campanha.titulo', read_only=True, default=None)

    class Meta:
        model = Doacao
        fields = [
            'id', 'apoiador', 'apoiador_nome', 'campanha', 'campanha_titulo',
            'valor', 'data', 'status', 'origem', 'consentimento_em',
        ]
        read_only_fields = ['origem', 'consentimento_em']

    def validate_valor(self, value):
        return _positivo(value, 'O valor deve ser maior que zero.')

    def validate_data(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError('A data da doação não pode estar no futuro.')
        return value

    def validate_campanha(self, value):
        mesma_de_antes = self.instance is not None and value is not None and self.instance.campanha_id == value.pk
        if value is not None and value.status == 'encerrada' and not mesma_de_antes:
            raise serializers.ValidationError('Não é possível registrar doações em uma campanha encerrada.')
        return value
