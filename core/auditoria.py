"""Trilha de auditoria: registra criação, edição (campo a campo) e exclusão com o usuário da requisição."""
from django.db import models

from .models import LogAlteracao

CAMPOS_IGNORADOS = {'id'}


def retrato(obj):
    """Valores atuais dos campos concretos do registro, como texto (FK pelo id)."""
    dados = {}
    for campo in obj._meta.concrete_fields:
        if campo.name in CAMPOS_IGNORADOS:
            continue
        valor = getattr(obj, campo.attname)
        if isinstance(campo, models.FileField):
            valor = valor.name if valor else ''
        dados[campo.name] = '' if valor is None else str(valor)
    return dados


def resumo(dados):
    return '; '.join(f'{k}={v}' for k, v in dados.items() if v != '')[:2000]


def registrar(usuario, obj, acao, campo='*', antes='', depois=''):
    LogAlteracao.objects.create(
        usuario=usuario if getattr(usuario, 'is_authenticated', False) else None,
        acao=acao,
        modelo=obj._meta.object_name,
        objeto_id=obj.pk,
        campo=campo,
        antes=antes,
        depois=depois,
    )


def registrar_diferencas(usuario, obj, antes, depois):
    for campo, valor_antes in antes.items():
        valor_depois = depois.get(campo, '')
        if valor_antes != valor_depois:
            registrar(usuario, obj, 'edicao', campo, valor_antes, valor_depois)


class AuditoriaMixin:
    """Para ModelViewSets: grava LogAlteracao em create, update/partial_update e destroy bem-sucedidos.

    Atua em create/update/destroy (e não em perform_*), porque os ViewSets já personalizam perform_*.
    Deve vir antes dos outros mixins na lista de bases.
    """

    def _modelo(self):
        return self.get_queryset().model

    def create(self, request, *args, **kwargs):
        resposta = super().create(request, *args, **kwargs)
        if resposta.status_code == 201 and 'id' in resposta.data:
            obj = self._modelo().objects.get(pk=resposta.data['id'])
            registrar(request.user, obj, 'criacao', depois=resumo(retrato(obj)))
        return resposta

    def update(self, request, *args, **kwargs):
        antes = retrato(self.get_object())
        resposta = super().update(request, *args, **kwargs)
        if resposta.status_code == 200:
            obj = self._modelo().objects.get(pk=kwargs[self.lookup_field])
            registrar_diferencas(request.user, obj, antes, retrato(obj))
        return resposta

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        antes = resumo(retrato(obj))
        pk = obj.pk
        resposta = super().destroy(request, *args, **kwargs)
        if resposta.status_code == 204:
            obj.pk = pk
            registrar(request.user, obj, 'exclusao', antes=antes)
        return resposta
