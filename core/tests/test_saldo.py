import json
from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from core import indicadores
from core.tests.factories import criar_despesa, criar_doacao, criar_membro, criar_staff
from core.tests.test_indicadores import relogio


def cenario():
    criar_doacao(valor=Decimal('1000'), data=date(2026, 3, 5))
    criar_doacao(valor=Decimal('300'), data=date(2026, 3, 20), status='pendente')
    criar_doacao(valor=Decimal('200'), data=date(2026, 3, 21), status='cancelada')
    criar_doacao(valor=Decimal('50'), data=date(2026, 4, 2))
    criar_despesa(valor=Decimal('400'), status='pago', data_vencimento=date(2026, 3, 10), data_pagamento=date(2026, 3, 12))
    criar_despesa(valor=Decimal('70'), status='pendente', data_vencimento=date(2026, 3, 15))
    criar_despesa(valor=Decimal('90'), status='cancelado', data_vencimento=date(2026, 3, 16))
    criar_despesa(valor=Decimal('30'), status='pago', data_vencimento=date(2026, 3, 30), data_pagamento=date(2026, 4, 1),
                  categoria='projetos')


class SaldoTests(TestCase):
    def setUp(self):
        cenario()

    def test_saldo_do_periodo_so_com_confirmadas_e_pagas(self):
        self.assertEqual(indicadores.receitas_confirmadas(date(2026, 3, 1), date(2026, 3, 31)), Decimal('1000'))
        self.assertEqual(indicadores.despesas_pagas(date(2026, 3, 1), date(2026, 3, 31)), Decimal('400'))
        self.assertEqual(indicadores.saldo(date(2026, 3, 1), date(2026, 3, 31)), Decimal('600'))
        self.assertEqual(indicadores.saldo(date(2026, 4, 1), date(2026, 4, 30)), Decimal('20'))
        self.assertEqual(indicadores.saldo(), Decimal('620'))

    def test_fluxo_mensal_com_saldo_acumulado(self):
        with relogio(2026, 4, 15):
            serie = indicadores.fluxo_mensal(meses=2)
        self.assertEqual([(m['isoMes'], m['receitas'], m['despesas'], m['saldo'], m['saldo_acumulado']) for m in serie], [
            ('2026-03', 1000.0, 400.0, 600.0, 600.0),
            ('2026-04', 50.0, 30.0, 20.0, 620.0),
        ])

    def test_saldo_do_mes_no_resumo_do_painel(self):
        with relogio(2026, 3, 25):
            saldo_mes = indicadores.resumo_painel()['saldo_mes']
        self.assertEqual((saldo_mes['value'], saldo_mes['receitas_mes'], saldo_mes['despesas_mes']), (600.0, 1000.0, 400.0))


class PrestacaoContasPublicaTests(APITestCase):
    def setUp(self):
        cache.clear()
        cenario()

    def test_dados_agregados_do_ano(self):
        criar_doacao(apoiador=criar_membro(nome='Pessoa Identificável'), valor=Decimal('5'), data=date(2026, 5, 1))
        resp = self.client.get('/api/public/prestacao-contas/?ano=2026')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual((resp.data['total_recebido'], resp.data['total_gasto'], resp.data['saldo']), (1055.0, 430.0, 625.0))
        self.assertEqual(len(resp.data['evolucao_mensal']), 12)
        self.assertEqual({c['categoria'] for c in resp.data['gasto_por_categoria']}, {'outros', 'projetos'})
        self.assertIn(2026, resp.data['anos_disponiveis'])
        self.assertNotIn('Pessoa Identificável', json.dumps(resp.data, ensure_ascii=False))

    def test_ano_invalido(self):
        self.assertEqual(self.client.get('/api/public/prestacao-contas/?ano=abc').status_code, 400)

    def test_fluxo_mensal_do_painel_exige_staff(self):
        self.assertEqual(self.client.get('/api/dashboard/fluxo-mensal/').status_code, 401)
        self.client.force_authenticate(criar_staff())
        self.assertEqual(len(self.client.get('/api/dashboard/fluxo-mensal/').data), 12)
