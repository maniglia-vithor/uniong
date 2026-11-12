"""CPF e CNPJ: limpeza, validação dos dígitos verificadores e formatação."""
import re


def somente_digitos(valor):
    return re.sub(r'\D', '', valor or '')


def cpf_valido(valor):
    cpf = somente_digitos(valor)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for tamanho in (9, 10):
        soma = sum(int(cpf[i]) * (tamanho + 1 - i) for i in range(tamanho))
        digito = (soma * 10) % 11 % 10
        if digito != int(cpf[tamanho]):
            return False
    return True


def cnpj_valido(valor):
    cnpj = somente_digitos(valor)
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    for tamanho in (12, 13):
        pesos = list(range(tamanho - 7, 1, -1)) + list(range(9, 1, -1))
        soma = sum(int(cnpj[i]) * pesos[i] for i in range(tamanho))
        resto = soma % 11
        digito = 0 if resto < 2 else 11 - resto
        if digito != int(cnpj[tamanho]):
            return False
    return True


def formatar_documento(valor):
    d = somente_digitos(valor)
    if len(d) == 11:
        return f'{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}'
    if len(d) == 14:
        return f'{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}'
    return valor or ''


def normalizar_documento(valor, aceitar=('cpf', 'cnpj')):
    """Devolve só os dígitos de um CPF/CNPJ válido; lança ValueError com mensagem em português."""
    d = somente_digitos(valor)
    if not d:
        return ''
    if len(d) == 11 and 'cpf' in aceitar:
        if cpf_valido(d):
            return d
        raise ValueError('CPF inválido: confira os dígitos.')
    if len(d) == 14 and 'cnpj' in aceitar:
        if cnpj_valido(d):
            return d
        raise ValueError('CNPJ inválido: confira os dígitos.')
    raise ValueError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).' if len(aceitar) > 1 else 'Informe um CNPJ com 14 dígitos.')
