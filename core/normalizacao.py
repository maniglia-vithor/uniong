import re


def normalizar_email(valor):
    return (valor or '').strip().lower()


def normalizar_celular(valor):
    """Aceita entrada com máscara e devolve só os dígitos (10 ou 11); vazio vira None."""
    if valor is None or not str(valor).strip():
        return None
    digitos = re.sub(r'\D', '', str(valor))
    if digitos.startswith('55') and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11):
        raise ValueError('Celular inválido. Informe DDD e número (10 ou 11 dígitos).')
    return digitos
