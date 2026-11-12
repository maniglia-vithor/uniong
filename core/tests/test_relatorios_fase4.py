from datetime import date
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.tests.factories import criar_campanha, criar_despesa, criar_doacao, criar_staff
from core.tests.test_relatorios import ler_csv


class RelatorioDespesasTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        camp = criar_campanha(titulo='Agasalho')
        criar_despesa(descricao='Cobertores', categoria='projetos', campanha=camp, valor=Decimal('250.50'),
                      status='pago', data_vencimento=date(2026, 2, 10), data_pagamento=date(2026, 2, 11))
        criar_despesa(descricao='=cmd|calc', categoria='administrativo', status='pendente', data_vencimento=date(2026, 3, 1))

    def test_colunas_e_valores(self):
        linhas = ler_csv(self.client.get('/api/relatorios/despesas/?categoria=projetos'))
        self.assertEqual(linhas[0], ['ID', 'Descrição', 'Categoria', 'Campanha', 'Valor (R$)', 'Vencimento', 'Pagamento', 'Status'])
        self.assertEqual(linhas[1][1:], ['Cobertores', 'Projetos', 'Agasalho', '250,50', '10/02/2026', '11/02/2026', 'Pago'])

    def test_filtros_e_neutralizacao(self):
        linhas = ler_csv(self.client.get('/api/relatorios/despesas/?status=pendente&data_inicio=2026-03-01'))
        self.assertEqual(len(linhas), 2)
        self.assertEqual(linhas[1][1], "'=cmd|calc")


class RelatorioPrestacaoContasTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        camp = criar_campanha(titulo='Natal')
        criar_doacao(campanha=camp, valor=Decimal('500'), data=date(2026, 1, 10))
        criar_doacao(valor=Decimal('100'), data=date(2026, 1, 11))
        criar_doacao(valor=Decimal('999'), data=date(2026, 1, 12), status='pendente')
        criar_despesa(descricao='Brinquedos', categoria='projetos', valor=Decimal('150'),
                      status='pago', data_vencimento=date(2026, 1, 15), data_pagamento=date(2026, 1, 16))
        criar_despesa(valor=Decimal('80'), status='pendente', data_vencimento=date(2026, 1, 20))

    def test_totais_e_agrupamentos(self):
        resp = self.client.get('/api/relatorios/prestacao-contas/?data_inicio=2026-01-01&data_fim=2026-01-31')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual((resp.data['total_receitas'], resp.data['total_despesas'], resp.data['saldo']), (600.0, 150.0, 450.0))
        self.assertEqual(resp.data['receitas_por_campanha'], [
            {'campanha': 'Natal', 'total': 500.0},
            {'campanha': 'Doações gerais (sem campanha)', 'total': 100.0},
        ])
        self.assertEqual(resp.data['despesas_por_categoria'], [{'categoria': 'Projetos', 'total': 150.0}])
        self.assertEqual([d['descricao'] for d in resp.data['despesas_pagas']], ['Brinquedos'])

    def test_periodo_invalido(self):
        resp = self.client.get('/api/relatorios/prestacao-contas/?data_inicio=2026-02-01&data_fim=2026-01-01')
        self.assertEqual(resp.status_code, 400)

    def test_exige_staff(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/relatorios/prestacao-contas/').status_code, 401)
