from django.db.models import Sum
from rest_framework import serializers
from .models import Apoiador, Campanha, Doacao, Comunicado, Notificacao, Despesa, DespesaAnexo, ConfiguracaoPix
from .pix import normalizar_chave_pix


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


class ApoiadorSerializer(serializers.ModelSerializer):
    total_doado = serializers.SerializerMethodField()

    class Meta:
        model = Apoiador
        fields = ['id', 'nome', 'email', 'celular', 'data_cadastro', 'status', 'total_doado']

    def get_total_doado(self, obj):
        total = obj.doacoes.filter(status='confirmada').aggregate(total=Sum('valor'))['total']
        return float(total) if total else 0.0


class CampanhaSerializer(serializers.ModelSerializer):
    percentual_progresso = serializers.ReadOnlyField()

    class Meta:
        model = Campanha
        fields = [
            'id', 'titulo', 'meta_valor', 'valor_arrecadado',
            'percentual_progresso', 'status', 'data_inicio', 'data_fim', 'descricao',
        ]


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
        fields = ['id', 'nome_original', 'url', 'enviado_em']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.arquivo and request:
            return request.build_absolute_uri(obj.arquivo.url)
        return obj.arquivo.url if obj.arquivo else None


class DespesaSerializer(serializers.ModelSerializer):
    status_efetivo = serializers.SerializerMethodField()
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    recurrence_period_display = serializers.CharField(
        source='get_recurrence_period_display', read_only=True, default=None
    )
    anexos = DespesaAnexoSerializer(many=True, read_only=True)

    class Meta:
        model = Despesa
        fields = [
            'id', 'descricao', 'valor', 'data_vencimento', 'data_pagamento',
            'categoria', 'categoria_display', 'status', 'status_efetivo',
            'is_fixed', 'recurrence_period', 'recurrence_period_display', 'anexos',
        ]

    def get_status_efetivo(self, obj):
        return obj.status_efetivo()


class DoacaoSerializer(serializers.ModelSerializer):
    apoiador_nome = serializers.CharField(source='apoiador.nome', read_only=True)
    campanha_titulo = serializers.CharField(source='campanha.titulo', read_only=True, default=None)

    class Meta:
        model = Doacao
        fields = [
            'id', 'apoiador', 'apoiador_nome', 'campanha', 'campanha_titulo',
            'valor', 'data', 'status',
        ]
