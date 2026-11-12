"""Cálculos de indicadores usados pelo painel, pelos painéis de detalhe, por Custos e pelo portal.

Todas as datas de referência vêm de `hoje()` (timezone.localdate, no fuso do Django).
"""
from datetime import date, timedelta
from decimal import Decimal

from dateutil.relativedelta import relativedelta
from django.db.models import Sum
from django.utils import timezone

from .models import Apoiador, Campanha, Despesa, Doacao


def hoje():
    return timezone.localdate()


def limites_mes(referencia=None):
    """(primeiro dia, último dia) do mês da data de referência."""
    referencia = referencia or hoje()
    inicio = referencia.replace(day=1)
    fim = inicio + relativedelta(months=1) - timedelta(days=1)
    return inicio, fim


def _soma(qs, campo='valor'):
    return qs.aggregate(total=Sum(campo))['total'] or Decimal('0')


# ── Doações ─────────────────────────────────────────────────────────────────
def doacoes_confirmadas():
    return Doacao.objects.filter(status='confirmada')


def doacoes_do_mes(referencia=None):
    inicio, fim = limites_mes(referencia)
    return doacoes_confirmadas().filter(data__gte=inicio, data__lte=fim)


def total_arrecadado(ate=None):
    qs = doacoes_confirmadas()
    if ate is not None:
        qs = qs.filter(data__lte=ate)
    return _soma(qs)


# ── Membros e campanhas ─────────────────────────────────────────────────────
def membros_ativos(ate=None):
    qs = Apoiador.objects.filter(status='ativo')
    if ate is not None:
        qs = qs.filter(data_cadastro__lte=ate)
    return qs


def campanhas_ativas(ate=None):
    """Campanhas em andamento (status ativa e sem data de fim vencida) na data de referência."""
    qs = Campanha.objects.em_andamento(referencia=ate)
    if ate is not None:
        qs = qs.filter(data_inicio__lte=ate)
    return qs


# ── Despesas ────────────────────────────────────────────────────────────────
def despesas_pagas_no_mes(referencia=None):
    """Gastos do mês: despesas pagas com data de pagamento no mês."""
    inicio, fim = limites_mes(referencia)
    return Despesa.objects.filter(status='pago', data_pagamento__gte=inicio, data_pagamento__lte=fim)


def despesas_a_pagar_no_mes(referencia=None):
    """Pendentes com vencimento no mês."""
    inicio, fim = limites_mes(referencia)
    return Despesa.objects.filter(status='pendente', data_vencimento__gte=inicio, data_vencimento__lte=fim)


def despesas_pendentes():
    """Todas as pendentes, inclusive vencidas."""
    return Despesa.objects.filter(status='pendente')


def despesas_atrasadas(referencia=None):
    return despesas_pendentes().filter(data_vencimento__lt=referencia or hoje())


# ── Tendências ──────────────────────────────────────────────────────────────
def variacao(atual, anterior):
    """Percentual de variação; None quando não há base de comparação (anterior = 0)."""
    if not anterior:
        return None
    return round(float((Decimal(atual) - Decimal(anterior)) / Decimal(anterior) * 100), 1)


def _direcao(pct):
    if pct is None or pct == 0:
        return 'neutral'
    return 'positive' if pct > 0 else 'negative'


def _kpi(valor, pct, **extra):
    return {'value': valor, 'trend_percentage': pct, 'trend_direction': _direcao(pct), **extra}


def resumo_painel(referencia=None):
    """KPIs do painel com tendências.

    - Total arrecadado: quanto o mês atual acrescentou, em valor e em % sobre o total do fim do mês anterior.
    - Doações do mês: mês atual (1º ao último dia) vs mês anterior completo.
    - Membros e campanhas ativos: a mesma regra (status atual e cadastro/início até a data) hoje e no
      fim do mês anterior. Limitação: não há histórico de status, então quem mudou de status no mês
      é contado com o status atual nos dois momentos.
    """
    referencia = referencia or hoje()
    inicio_mes, _ = limites_mes(referencia)
    fim_mes_anterior = inicio_mes - timedelta(days=1)

    total = total_arrecadado()
    total_ate_mes_anterior = total_arrecadado(ate=fim_mes_anterior)
    acrescimo = _soma(doacoes_do_mes(referencia))

    doacoes_mes = acrescimo
    doacoes_mes_anterior = _soma(doacoes_do_mes(fim_mes_anterior))

    membros = membros_ativos().count()
    membros_antes = membros_ativos(ate=fim_mes_anterior).count()
    campanhas = campanhas_ativas().count()
    campanhas_antes = campanhas_ativas(ate=fim_mes_anterior).count()

    return {
        'total_arrecadado': _kpi(
            float(total),
            None if not total_ate_mes_anterior else round(float(acrescimo / total_ate_mes_anterior * 100), 1),
            acrescimo_mes=float(acrescimo),
        ),
        'doacoes_mes': _kpi(float(doacoes_mes), variacao(doacoes_mes, doacoes_mes_anterior)),
        'apoiadores_ativos': _kpi(membros, variacao(membros, membros_antes)),
        'campanhas_ativas': _kpi(campanhas, variacao(campanhas, campanhas_antes)),
        'saldo_mes': _kpi(
            float(saldo(inicio_mes, limites_mes(referencia)[1])),
            None,
            receitas_mes=float(doacoes_mes),
            despesas_mes=float(despesas_pagas(inicio_mes, limites_mes(referencia)[1])),
        ),
    }


def resumo_despesas(referencia=None):
    referencia = referencia or hoje()
    pagas = despesas_pagas_no_mes(referencia)
    por_categoria = (
        pagas.values('categoria').annotate(total=Sum('valor')).order_by('-total')
    )
    maior = por_categoria[0]['categoria'] if por_categoria else None
    return {
        'gasto_mes': float(_soma(pagas)),
        'a_pagar_mes': float(_soma(despesas_a_pagar_no_mes(referencia))),
        'total_pendente': float(_soma(despesas_pendentes())),
        'total_atrasado': float(_soma(despesas_atrasadas(referencia))),
        'maior_categoria': maior,
        'maior_categoria_display': dict(Despesa.CATEGORIA_CHOICES).get(maior, '—'),
    }


def gastos_por_categoria(referencia=None):
    rotulos = dict(Despesa.CATEGORIA_CHOICES)
    dados = despesas_pagas_no_mes(referencia).values('categoria').annotate(total=Sum('valor')).order_by('-total')
    return [
        {'categoria': d['categoria'], 'label': rotulos.get(d['categoria'], d['categoria']), 'total': float(d['total'])}
        for d in dados
    ]


def serie_mensal_doacoes(meses=12, referencia=None):
    referencia = referencia or hoje()
    nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    serie = []
    for i in range(meses - 1, -1, -1):
        mes = (referencia.replace(day=1) - relativedelta(months=i))
        serie.append({
            'mes': f"{nomes[mes.month - 1]}/{mes.strftime('%y')}",
            'isoMes': mes.strftime('%Y-%m'),
            'total': float(_soma(doacoes_do_mes(mes))),
        })
    return serie


# ── Receitas, despesas e saldo por período ──────────────────────────────────
NOMES_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']


def limites_ano(ano):
    return date(ano, 1, 1), date(ano, 12, 31)


def receitas_confirmadas(inicio=None, fim=None):
    """Soma das doações confirmadas com data no período (limites inclusivos; None = sem limite)."""
    qs = doacoes_confirmadas()
    if inicio:
        qs = qs.filter(data__gte=inicio)
    if fim:
        qs = qs.filter(data__lte=fim)
    return _soma(qs)


def despesas_pagas(inicio=None, fim=None):
    """Soma das despesas pagas com data de pagamento no período."""
    qs = Despesa.objects.filter(status='pago')
    if inicio:
        qs = qs.filter(data_pagamento__gte=inicio)
    if fim:
        qs = qs.filter(data_pagamento__lte=fim)
    return _soma(qs)


def saldo(inicio=None, fim=None):
    return receitas_confirmadas(inicio, fim) - despesas_pagas(inicio, fim)


def fluxo_mensal(meses=12, referencia=None, ano=None):
    """Receitas, despesas, saldo do mês e saldo acumulado (desde o início) para cada mês.

    Com `ano`, devolve os 12 meses daquele ano; senão, os `meses` últimos até a referência.
    """
    if ano is not None:
        primeiros = [date(ano, m, 1) for m in range(1, 13)]
    else:
        referencia = referencia or hoje()
        primeiros = [referencia.replace(day=1) - relativedelta(months=i) for i in range(meses - 1, -1, -1)]
    serie = []
    for inicio in primeiros:
        _, fim = limites_mes(inicio)
        receitas = receitas_confirmadas(inicio, fim)
        despesas = despesas_pagas(inicio, fim)
        serie.append({
            'mes': f"{NOMES_MESES[inicio.month - 1]}/{inicio.strftime('%y')}",
            'isoMes': inicio.strftime('%Y-%m'),
            'receitas': float(receitas),
            'despesas': float(despesas),
            'saldo': float(receitas - despesas),
            'saldo_acumulado': float(saldo(fim=fim)),
        })
    return serie


def anos_com_movimento():
    anos = set(Doacao.objects.filter(status='confirmada').dates('data', 'year').values_list('data__year', flat=True))
    anos |= set(
        Despesa.objects.filter(status='pago', data_pagamento__isnull=False)
        .dates('data_pagamento', 'year').values_list('data_pagamento__year', flat=True)
    )
    anos.add(hoje().year)
    return sorted(anos, reverse=True)


def prestacao_de_contas(ano):
    """Dados agregados (sem nomes) para a prestação de contas pública de um ano."""
    inicio, fim = limites_ano(ano)
    rotulos = dict(Despesa.CATEGORIA_CHOICES)
    por_categoria = (
        Despesa.objects.filter(status='pago', data_pagamento__gte=inicio, data_pagamento__lte=fim)
        .values('categoria').annotate(total=Sum('valor')).order_by('-total')
    )
    recebido = receitas_confirmadas(inicio, fim)
    gasto = despesas_pagas(inicio, fim)
    return {
        'ano': ano,
        'anos_disponiveis': anos_com_movimento(),
        'total_recebido': float(recebido),
        'total_gasto': float(gasto),
        'saldo': float(recebido - gasto),
        'gasto_por_categoria': [
            {'categoria': d['categoria'], 'label': rotulos.get(d['categoria'], d['categoria']), 'total': float(d['total'])}
            for d in por_categoria
        ],
        'evolucao_mensal': fluxo_mensal(ano=ano),
    }


def mes_do_parametro(valor):
    """Converte 'AAAA-MM' na data do 1º dia; lança ValueError se inválido."""
    ano, mes = valor.split('-')
    return date(int(ano), int(mes), 1)
