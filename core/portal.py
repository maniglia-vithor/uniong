"""Representação pública (portal de transparência) de dados internos."""
from decimal import Decimal

from .models import Despesa

CATEGORIA_AGREGADA = 'recursos_humanos'


def despesas_publicas(despesas):
    """Lista de despesas para o portal.

    Nunca expõe a descrição interna: usa `descricao_publica` ou, se vazia, só a categoria.
    Despesas de recursos humanos são agregadas numa linha "Recursos humanos (N lançamentos)",
    para não revelar salários individuais.
    """
    rotulos = dict(Despesa.CATEGORIA_CHOICES)
    linhas, rh_total, rh_qtd = [], Decimal('0'), 0
    for d in despesas:
        if d.categoria == CATEGORIA_AGREGADA:
            rh_total += d.valor
            rh_qtd += 1
            continue
        linhas.append({
            'descricao': d.descricao_publica.strip() or rotulos.get(d.categoria, d.categoria),
            'categoria': rotulos.get(d.categoria, d.categoria),
            'valor': float(d.valor),
        })
    if rh_qtd:
        linhas.append({
            'descricao': f'Recursos humanos ({rh_qtd} lançamento{"s" if rh_qtd > 1 else ""})',
            'categoria': rotulos[CATEGORIA_AGREGADA],
            'valor': float(rh_total),
        })
    return sorted(linhas, key=lambda linha: -linha['valor'])
