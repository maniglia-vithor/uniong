from datetime import date
from decimal import Decimal
from itertools import count

from django.contrib.auth import get_user_model

from core.models import Apoiador, Campanha, Despesa, Doacao

_seq = count(1)


def _n():
    return next(_seq)


def criar_usuario(**kwargs):
    n = _n()
    dados = {'username': f'usuario{n}', 'email': f'usuario{n}@exemplo.org', 'password': 'senha-teste-123'}
    dados.update(kwargs)
    return get_user_model().objects.create_user(**dados)


def criar_staff(**kwargs):
    kwargs.setdefault('is_staff', True)
    return criar_usuario(**kwargs)


def criar_membro(**kwargs):
    n = _n()
    dados = {'nome': f'Membro {n}', 'email': f'membro{n}@exemplo.org', 'status': 'ativo'}
    dados.update(kwargs)
    return Apoiador.objects.create(**dados)


def criar_campanha(**kwargs):
    n = _n()
    dados = {
        'titulo': f'Campanha {n}',
        'meta_valor': Decimal('1000.00'),
        'status': 'ativa',
        'data_inicio': date(2026, 1, 1),
    }
    dados.update(kwargs)
    return Campanha.objects.create(**dados)


def criar_doacao(**kwargs):
    dados = {'valor': Decimal('100.00'), 'data': date(2026, 1, 15), 'status': 'confirmada'}
    dados.update(kwargs)
    if 'apoiador' not in dados:
        dados['apoiador'] = criar_membro()
    return Doacao.objects.create(**dados)


def criar_despesa(**kwargs):
    n = _n()
    dados = {
        'descricao': f'Despesa {n}',
        'valor': Decimal('200.00'),
        'data_vencimento': date(2026, 1, 10),
        'categoria': 'outros',
        'status': 'pendente',
    }
    dados.update(kwargs)
    return Despesa.objects.create(**dados)
