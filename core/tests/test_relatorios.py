import csv
import io
from datetime import date
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.relatorios import texto
from core.tests.factories import criar_campanha, criar_doacao, criar_membro, criar_staff


def ler_csv(resposta):
    conteudo = resposta.content.decode('utf-8')
    assert conteudo.startswith('﻿')
    return list(csv.reader(io.StringIO(conteudo[1:]), delimiter=';'))


class RelatoriosCsvTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())

    def test_injecao_de_formula_neutralizada(self):
        criar_membro(nome='=HYPERLINK("http://x","clique")', email='x@exemplo.org', celular='11987654321')
        linhas = ler_csv(self.client.get('/api/relatorios/apoiadores/'))
        cabecalho, linha = linhas[0], linhas[1]
        self.assertEqual(len(linha), len(cabecalho))
        self.assertEqual(linha[1], '\'=HYPERLINK("http://x","clique")')
        self.assertIn('Celular', cabecalho)
        self.assertEqual(linha[3], '11987654321')

    def test_neutralizacao_dos_prefixos(self):
        for perigoso in ['=1+1', '+5', '-3', '@SUM(A1)', '\tx', '\rx']:
            self.assertTrue(texto(perigoso).startswith("'"))
        self.assertEqual(texto('Ana'), 'Ana')

    def test_doacoes_uma_coluna_por_campo_decimal_e_data_br(self):
        camp = criar_campanha(titulo='Natal; crianças')
        criar_doacao(campanha=camp, valor=Decimal('1234.50'), data=date(2026, 3, 9))
        linhas = ler_csv(self.client.get('/api/relatorios/doacoes/'))
        self.assertEqual(len(linhas[1]), 11)
        self.assertEqual(linhas[1][2], 'Natal; crianças')
        self.assertEqual(linhas[1][3], 'Financeira')
        self.assertEqual(linhas[1][4], '1234,50')
        self.assertEqual(linhas[1][7], 'PIX')
        self.assertEqual(linhas[1][8], '09/03/2026')

    def test_filtros_de_periodo_e_status(self):
        criar_doacao(data=date(2026, 1, 5))
        criar_doacao(data=date(2026, 2, 5))
        criar_doacao(data=date(2026, 2, 6), status='pendente')
        linhas = ler_csv(self.client.get('/api/relatorios/doacoes/?data_inicio=2026-02-01&data_fim=2026-02-28&status=confirmada'))
        self.assertEqual(len(linhas), 2)
        self.assertEqual(linhas[1][8], '05/02/2026')

    def test_campanhas(self):
        criar_campanha(titulo='Agasalho', meta_valor=Decimal('100'))
        linhas = ler_csv(self.client.get('/api/relatorios/campanhas/?status=ativa'))
        self.assertEqual(len(linhas[1]), 8)
        self.assertEqual(linhas[1][2], '100,00')
