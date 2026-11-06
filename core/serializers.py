from django.db.models import Sum
from rest_framework import serializers
from .models import Apoiador, Campanha, Doacao, Comunicado, Notificacao, Despesa


class ApoiadorSerializer(serializers.ModelSerializer):
    total_doado = serializers.SerializerMethodField()

    class Meta:
        model = Apoiador
        fields = ['id', 'nome', 'email', 'data_cadastro', 'status', 'total_doado']

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


class DespesaSerializer(serializers.ModelSerializer):
    status_efetivo = serializers.SerializerMethodField()
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)

    class Meta:
        model = Despesa
        fields = [
            'id', 'descricao', 'valor', 'data_vencimento', 'data_pagamento',
            'categoria', 'categoria_display', 'status', 'status_efetivo',
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
