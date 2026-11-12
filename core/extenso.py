"""Valor em reais por extenso (para recibos)."""
from decimal import ROUND_HALF_UP, Decimal

UNIDADES = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
            'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
            'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
ESCALAS = [('', ''), ('mil', 'mil'), ('milhão', 'milhões'), ('bilhão', 'bilhões')]


def _ate_999(n):
    if n == 100:
        return 'cem'
    partes = []
    c, resto = divmod(n, 100)
    if c:
        partes.append(CENTENAS[c])
    if resto < 20:
        if resto or not partes:
            partes.append(UNIDADES[resto])
    else:
        d, u = divmod(resto, 10)
        partes.append(DEZENAS[d] + (f' e {UNIDADES[u]}' if u else ''))
    return ' e '.join(p for p in partes if p)


def inteiro_por_extenso(n):
    if n == 0:
        return 'zero'
    grupos = []
    while n:
        n, g = divmod(n, 1000)
        grupos.append(g)
    partes = []
    for i in range(len(grupos) - 1, -1, -1):
        g = grupos[i]
        if not g:
            continue
        singular, plural = ESCALAS[i]
        if i == 1:
            texto = 'mil' if g == 1 else f'{_ate_999(g)} mil'
        elif i > 1:
            texto = f'{_ate_999(g)} {singular if g == 1 else plural}'
        else:
            texto = _ate_999(g)
        partes.append((texto, g))
    # "e" antes do último grupo quando ele é < 100 ou centena exata (ex.: mil e cinquenta, dois mil e trezentos).
    resultado = partes[0][0]
    for texto, g in partes[1:]:
        conector = ' e ' if (g < 100 or g % 100 == 0) else ' '
        resultado += conector + texto
    return resultado


def reais_por_extenso(valor):
    valor = Decimal(valor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
    if valor < 0:
        raise ValueError('Valor negativo.')
    reais = int(valor)
    centavos = int((valor - reais) * 100)
    partes = []
    if reais:
        texto = inteiro_por_extenso(reais)
        # "um milhão de reais", "dois milhões de reais"
        de = ' de' if reais % 1_000_000 == 0 else ''
        partes.append(f"{texto}{de} {'real' if reais == 1 else 'reais'}")
    if centavos:
        partes.append(f"{inteiro_por_extenso(centavos)} {'centavo' if centavos == 1 else 'centavos'}")
    if not partes:
        return 'zero real'
    return ' e '.join(partes)
