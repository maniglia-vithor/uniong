"""Geração das doações pendentes das contribuições periódicas (mensalidades)."""
from datetime import date

from django.db import IntegrityError, transaction

from .models import Contribuicao, Doacao


def gerar_doacoes_do_mes(competencia):
    """Cria, para o mês de `competencia`, a doação pendente de cada contribuição ativa que vence nele.

    Idempotente: a restrição única (contribuicao, competencia) impede duplicatas, mesmo com
    execuções simultâneas. Devolve (criadas, ja_existentes).
    """
    competencia = date(competencia.year, competencia.month, 1)
    criadas = existentes = 0
    contribuicoes = Contribuicao.objects.filter(ativa=True, data_inicio__lte=_ultimo_dia(competencia)).select_related('apoiador')
    for contribuicao in contribuicoes:
        if not contribuicao.vence_no_mes(competencia):
            continue
        if Doacao.objects.filter(contribuicao=contribuicao, competencia=competencia).exists():
            existentes += 1
            continue
        try:
            with transaction.atomic():
                Doacao.objects.create(
                    apoiador=contribuicao.apoiador,
                    valor=contribuicao.valor,
                    data=competencia.replace(day=min(contribuicao.dia_vencimento, 28)),
                    status='pendente',
                    origem='contribuicao',
                    forma_pagamento=contribuicao.forma_pagamento,
                    contribuicao=contribuicao,
                    competencia=competencia,
                    observacao=f'{contribuicao.get_periodicidade_display()} — competência {competencia:%m/%Y}',
                )
            criadas += 1
        except IntegrityError:
            existentes += 1
    return criadas, existentes


def _ultimo_dia(competencia):
    proximo = date(competencia.year + (competencia.month == 12), competencia.month % 12 + 1, 1)
    return date.fromordinal(proximo.toordinal() - 1)
