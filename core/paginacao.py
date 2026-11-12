from datetime import date

from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


class PaginacaoPadrao(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 500


def _data_param(request, nome):
    valor = request.query_params.get(nome)
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError({nome: 'Data inválida. Use o formato AAAA-MM-DD.'})


def filtrar_periodo(queryset, request, campo):
    """Aplica ?data_inicio= e ?data_fim= (inclusivos) sobre o campo de data informado."""
    inicio = _data_param(request, 'data_inicio')
    fim = _data_param(request, 'data_fim')
    if inicio:
        queryset = queryset.filter(**{f'{campo}__gte': inicio})
    if fim:
        queryset = queryset.filter(**{f'{campo}__lte': fim})
    return queryset
