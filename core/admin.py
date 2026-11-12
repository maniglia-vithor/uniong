from django.contrib import admin

from .models import (
    Apoiador, Campanha, Comunicado, ConfiguracaoInstituicao, ConfiguracaoPix, Despesa, DespesaAnexo,
    Doacao, LogAlteracao, Notificacao,
)


class SomenteLeituraMixin:
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class SingletonAdmin(admin.ModelAdmin):
    """Registro único (pk=1): não permite criar outro nem excluir."""

    def has_add_permission(self, request):
        return not self.model.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LogAlteracao)
class LogAlteracaoAdmin(SomenteLeituraMixin, admin.ModelAdmin):
    list_display = ['data', 'usuario', 'modelo', 'objeto_id', 'campo', 'antes', 'depois']
    list_filter = ['modelo', 'campo', 'usuario']
    date_hierarchy = 'data'


@admin.register(Apoiador)
class ApoiadorAdmin(admin.ModelAdmin):
    list_display = ['nome', 'email', 'celular', 'status', 'data_cadastro']
    list_filter = ['status']
    search_fields = ['nome', 'email']


@admin.register(Campanha)
class CampanhaAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'meta_valor', 'valor_arrecadado', 'percentual_progresso', 'status']
    list_filter = ['status']
    search_fields = ['titulo']

    def get_queryset(self, request):
        return super().get_queryset(request).com_arrecadado()


@admin.register(Doacao)
class DoacaoAdmin(admin.ModelAdmin):
    list_display = ['apoiador', 'campanha', 'valor', 'data', 'status', 'origem']
    list_filter = ['status', 'origem']
    search_fields = ['apoiador__nome', 'campanha__titulo']
    date_hierarchy = 'data'


class DespesaAnexoInline(admin.TabularInline):
    model = DespesaAnexo
    extra = 0
    fields = ['nome_original', 'arquivo', 'enviado_em']
    readonly_fields = ['enviado_em']


@admin.register(Despesa)
class DespesaAdmin(admin.ModelAdmin):
    list_display = ['descricao', 'categoria', 'valor', 'data_vencimento', 'data_pagamento', 'status', 'is_fixed']
    list_filter = ['status', 'categoria', 'is_fixed', 'recurrence_period']
    search_fields = ['descricao', 'descricao_publica']
    date_hierarchy = 'data_vencimento'
    readonly_fields = ['serie_id', 'data_ancora', 'numero_ocorrencia']
    inlines = [DespesaAnexoInline]


@admin.register(Comunicado)
class ComunicadoAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'publico_alvo', 'data_publicacao']
    list_filter = ['publico_alvo']


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ['criada_em', 'usuario', 'tipo', 'actor_name', 'action_text', 'lida']
    list_filter = ['tipo', 'lida']
    search_fields = ['mensagem', 'actor_name']


@admin.register(ConfiguracaoPix)
class ConfiguracaoPixAdmin(SingletonAdmin):
    list_display = ['chave', 'nome_recebedor', 'cidade']


@admin.register(ConfiguracaoInstituicao)
class ConfiguracaoInstituicaoAdmin(SingletonAdmin):
    list_display = ['__str__', 'portal_ativo']
