import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email

_UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')


def _digitos_verificadores_ok(numeros, pesos_lista):
    for pesos in pesos_lista:
        base = numeros[:len(pesos)]
        resto = sum(int(d) * p for d, p in zip(base, pesos)) % 11
        dv = 0 if resto < 2 else 11 - resto
        if int(numeros[len(pesos)]) != dv:
            return False
    return True


def cpf_valido(cpf):
    if len(cpf) != 11 or len(set(cpf)) == 1:
        return False
    return _digitos_verificadores_ok(cpf, [range(10, 1, -1), range(11, 1, -1)])


def cnpj_valido(cnpj):
    if len(cnpj) != 14 or len(set(cnpj)) == 1:
        return False
    return _digitos_verificadores_ok(cnpj, [
        [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
        [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    ])


def normalizar_chave_pix(valor):
    """Valida a chave PIX e devolve (chave_normalizada, tipo). Lança ValueError com mensagem em português."""
    chave = (valor or '').strip()
    if not chave:
        return '', ''

    if '@' in chave:
        chave = chave.lower()
        try:
            validate_email(chave)
        except DjangoValidationError:
            raise ValueError('E-mail inválido para chave PIX.')
        if len(chave) > 77:
            raise ValueError('A chave PIX por e-mail pode ter no máximo 77 caracteres.')
        return chave, 'email'

    if chave.startswith('+'):
        telefone = '+' + re.sub(r'[\s()\-]', '', chave[1:])
        if not re.fullmatch(r'\+55\d{10,11}', telefone):
            raise ValueError('Telefone inválido. Use o formato +55 seguido de DDD e número (ex.: +5511999998888).')
        return telefone, 'telefone'

    if _UUID.match(chave.lower()):
        return chave.lower(), 'aleatoria'

    numeros = re.sub(r'[.\-/\s]', '', chave)
    if numeros.isdigit():
        if len(numeros) == 11:
            if not cpf_valido(numeros):
                raise ValueError('CPF inválido.')
            return numeros, 'cpf'
        if len(numeros) == 14:
            if not cnpj_valido(numeros):
                raise ValueError('CNPJ inválido.')
            return numeros, 'cnpj'

    raise ValueError(
        'Chave PIX inválida. Use CPF, CNPJ, e-mail, telefone (+55...) ou chave aleatória.'
    )


def mascarar(valor):
    valor = valor or ''
    if not valor:
        return '(vazio)'
    if len(valor) <= 5:
        return '*' * len(valor)
    return valor[:3] + '*' * (len(valor) - 5) + valor[-2:]
