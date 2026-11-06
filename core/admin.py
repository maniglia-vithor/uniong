from django.contrib import admin
from .models import Apoiador, Campanha, Doacao, Comunicado


@admin.register(Apoiador)
class ApoiadorAdmin(admin.ModelAdmin):
    list_display = ['nome', 'email', 'status', 'data_cadastro']
    list_filter = ['status']
    search_fields = ['nome', 'email']


@admin.register(Campanha)
class CampanhaAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'meta_valor', 'valor_arrecadado', 'percentual_progresso', 'status']
    list_filter = ['status']
    search_fields = ['titulo']


@admin.register(Doacao)
class DoacaoAdmin(admin.ModelAdmin):
    list_display = ['apoiador', 'campanha', 'valor', 'data', 'status']
    list_filter = ['status']
    search_fields = ['apoiador__nome']


@admin.register(Comunicado)
class ComunicadoAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'publico_alvo', 'data_publicacao']
    list_filter = ['publico_alvo']
