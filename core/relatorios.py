"""Relatórios CSV: delimitador ';', BOM UTF-8, decimal com vírgula, datas dd/mm/aaaa."""
import csv
from datetime import date
from decimal import Decimal

from django.db.models import DecimalField, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from . import indicadores
from .models import Apoiador, Campanha, ConfiguracaoInstituicao, Despesa, Doacao
from .serializers import dados_publicos_instituicao
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
    tipo = request.query_params.get('tipo')
    if tipo:
        qs = qs.filter(tipo=tipo)
    csv_out.writerow([
        'ID', 'Membro', 'Campanha', 'Tipo', 'Valor (R$)', 'Itens doados', 'Valor estimado (R$)',
        'Forma de pagamento', 'Data', 'Status', 'Observação',
    ])
    for d in qs:
        csv_out.writerow([
            d.id, texto(d.nome_doador), texto(d.campanha.titulo if d.campanha else ''), d.get_tipo_display(),
            moeda(d.valor) if d.tipo == 'financeira' else '', texto(d.descricao_bens),
            moeda(d.valor_estimado) if d.valor_estimado is not None else '',
            d.get_forma_pagamento_display() if d.forma_pagamento else '',
            data_br(d.data), d.get_status_display(), texto(d.observacao),
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
def relatorio_despesas(request):
    qs = Despesa.objects.select_related('campanha').order_by('-data_vencimento', '-id')
    status = request.query_params.get('status')
    if status == 'atrasado':
        qs = qs.filter(status='pendente', data_vencimento__lt=indicadores.hoje())
    elif status:
        qs = qs.filter(status=status)
    categoria = request.query_params.get('categoria')
    if categoria:
        qs = qs.filter(categoria=categoria)
    qs = filtrar_periodo(qs, request, 'data_vencimento')
    resposta, csv_out = _resposta('relatorio_despesas.csv')
    csv_out.writerow(['ID', 'Descrição', 'Categoria', 'Campanha', 'Valor (R$)', 'Vencimento', 'Pagamento', 'Status'])
    for d in qs:
        status_txt = 'Atrasado' if d.status_efetivo() == 'atrasado' else d.get_status_display()
        csv_out.writerow([
            d.id, texto(d.descricao), d.get_categoria_display(), texto(d.campanha.titulo if d.campanha else ''),
            moeda(d.valor), data_br(d.data_vencimento), data_br(d.data_pagamento), status_txt,
        ])
    return resposta


@api_view(['GET'])
def relatorio_prestacao_contas(request):
    """Dados para o relatório imprimível de prestação de contas de um período (padrão: ano atual)."""
    hoje = indicadores.hoje()
    inicio = _data(request, 'data_inicio') or date(hoje.year, 1, 1)
    fim = _data(request, 'data_fim') or date(hoje.year, 12, 31)
    if fim < inicio:
        raise ValidationError({'data_fim': 'O fim do período não pode ser anterior ao início.'})

    doacoes = Doacao.objects.filter(status='confirmada', tipo='financeira', data__gte=inicio, data__lte=fim)
    receitas = [
        {'campanha': d['campanha__titulo'] or 'Doações gerais (sem campanha)', 'total': float(d['total'])}
        for d in doacoes.values('campanha__titulo').annotate(total=Sum('valor')).order_by('-total')
    ]
    pagas = Despesa.objects.filter(status='pago', data_pagamento__gte=inicio, data_pagamento__lte=fim)
    rotulos = dict(Despesa.CATEGORIA_CHOICES)
    por_categoria = [
        {'categoria': rotulos.get(d['categoria'], d['categoria']), 'total': float(d['total'])}
        for d in pagas.values('categoria').annotate(total=Sum('valor')).order_by('-total')
    ]
    total_receitas = indicadores.receitas_confirmadas(inicio, fim)
    total_despesas = indicadores.despesas_pagas(inicio, fim)
    return Response({
        'instituicao': dados_publicos_instituicao(ConfiguracaoInstituicao.obter()),
        'data_inicio': inicio.isoformat(),
        'data_fim': fim.isoformat(),
        'gerado_em': timezone.localtime().isoformat(),
        'total_receitas': float(total_receitas),
        'total_despesas': float(total_despesas),
        'saldo': float(total_receitas - total_despesas),
        'receitas_por_campanha': receitas,
        'despesas_por_categoria': por_categoria,
        'despesas_pagas': [
            {
                'descricao': d.descricao,
                'categoria': d.get_categoria_display(),
                'campanha': d.campanha.titulo if d.campanha else None,
                'valor': float(d.valor),
                'data_pagamento': d.data_pagamento.isoformat(),
            }
            for d in pagas.select_related('campanha').order_by('data_pagamento', 'id')
        ],
    })


def _data(request, nome):
    valor = request.query_params.get(nome)
    if not valor:
        return None
    try:
        return date.fromisoformat(valor)
    except ValueError:
        raise ValidationError({nome: 'Data inválida. Use o formato AAAA-MM-DD.'})


@api_view(['GET'])
def relatorio_apoiadores(request):
    qs = Apoiador.objects.annotate(
        total_doado=Coalesce(
            Sum('doacoes__valor', filter=Q(doacoes__status='confirmada', doacoes__tipo='financeira')),
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
