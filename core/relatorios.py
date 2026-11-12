"""Relatórios CSV: delimitador ';', BOM UTF-8, decimal com vírgula, datas dd/mm/aaaa."""
import csv
from decimal import Decimal

from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from rest_framework.decorators import api_view

from .models import Apoiador, Campanha, Doacao
from .paginacao import filtrar_periodo

INICIOS_PERIGOSOS = ('=', '+', '-', '@', '\t', '\r')


def texto(valor):
    """Neutraliza injeção de fórmulas no Excel/LibreOffice prefixando com apóstrofo."""
    valor = '' if valor is None else str(valor)
    return "'" + valor if valor.startswith(INICIOS_PERIGOSOS) else valor


def moeda(valor):
    return f'{Decimal(valor or 0):.2f}'.replace('.', ',')


def data_br(valor):
    return valor.strftime('%d/%m/%Y') if valor else ''


def _resposta(nome_arquivo):
    resposta = HttpResponse(content_type='text/csv; charset=utf-8')
    resposta['Content-Disposition'] = f'attachment; filename="{nome_arquivo}"'
    resposta.write('﻿')
    return resposta, csv.writer(resposta, delimiter=';')


def _status(qs, request):
    status = request.query_params.get('status')
    return qs.filter(status=status) if status else qs


@api_view(['GET'])
def relatorio_doacoes(request):
    qs = Doacao.objects.select_related('apoiador', 'campanha').order_by('-data', '-id')
    qs = filtrar_periodo(_status(qs, request), request, 'data')
    resposta, csv_out = _resposta('relatorio_doacoes.csv')
    csv_out.writerow(['ID', 'Membro', 'Campanha', 'Valor (R$)', 'Data', 'Status'])
    for d in qs:
        csv_out.writerow([
            d.id, texto(d.apoiador.nome), texto(d.campanha.titulo if d.campanha else ''),
            moeda(d.valor), data_br(d.data), d.get_status_display(),
        ])
    return resposta


@api_view(['GET'])
def relatorio_campanhas(request):
    qs = Campanha.objects.com_arrecadado().order_by('-data_inicio', '-id')
    qs = filtrar_periodo(_status(qs, request), request, 'data_inicio')
    resposta, csv_out = _resposta('relatorio_campanhas.csv')
    csv_out.writerow(['ID', 'Título', 'Meta (R$)', 'Arrecadado (R$)', 'Progresso (%)', 'Status', 'Início', 'Fim'])
    for c in qs:
        csv_out.writerow([
            c.id, texto(c.titulo), moeda(c.meta_valor), moeda(c.valor_arrecadado),
            str(c.percentual_progresso).replace('.', ','), c.get_status_display(),
            data_br(c.data_inicio), data_br(c.data_fim),
        ])
    return resposta


@api_view(['GET'])
def relatorio_apoiadores(request):
    qs = Apoiador.objects.annotate(
        total_doado=Coalesce(
            Sum('doacoes__valor', filter=Q(doacoes__status='confirmada')),
            Value(Decimal('0')),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
    ).order_by('nome')
    qs = filtrar_periodo(_status(qs, request), request, 'data_cadastro')
    resposta, csv_out = _resposta('relatorio_membros.csv')
    csv_out.writerow(['ID', 'Nome', 'E-mail', 'Celular', 'Data de Cadastro', 'Status', 'Total Doado (R$)'])
    for a in qs:
        csv_out.writerow([
            a.id, texto(a.nome), texto(a.email), texto(a.celular or ''),
            data_br(a.data_cadastro), a.get_status_display(), moeda(a.total_doado),
        ])
    return resposta
