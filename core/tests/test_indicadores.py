from datetime import date, datetime
from decimal import Decimal
from unittest import mock
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from core import indicadores
from core.models import Apoiador
from core.tests.factories import criar_despesa, criar_doacao, criar_membro, criar_staff

BRT = ZoneInfo('America/Sao_Paulo')


def relogio(ano, mes, dia, hora=12, minuto=0):
    """Fixa timezone.now() num horário de Brasília (convertido para UTC, como o Django usa)."""
    momento = datetime(ano, mes, dia, hora, minuto, tzinfo=BRT).astimezone(ZoneInfo('UTC'))
    return mock.patch('django.utils.timezone.now', return_value=momento)


class IndicadoresTests(TestCase):
    def test_virada_de_mes(self):
        criar_doacao(valor=Decimal('100'), data=date(2026, 1, 31))
        criar_doacao(valor=Decimal('40'), data=date(2026, 2, 1))
        with relogio(2026, 2, 1, 10):
            resumo = indicadores.resumo_painel()
        self.assertEqual(resumo['doacoes_mes']['value'], 40.0)
        self.assertEqual(resumo['doacoes_mes']['trend_percentage'], -60.0)
        self.assertEqual(resumo['total_arrecadado']['value'], 140.0)
        self.assertEqual(resumo['total_arrecadado']['acrescimo_mes'], 40.0)
        self.assertEqual(resumo['total_arrecadado']['trend_percentage'], 40.0)

    def test_ultimo_dia_do_mes_as_22h_de_brasilia(self):
        # 31/01 22:00 em Brasília já é 01/02 01:00 em UTC: o mês continua sendo janeiro.
        criar_doacao(valor=Decimal('75'), data=date(2026, 1, 31))
        with relogio(2026, 1, 31, 22):
            self.assertEqual(indicadores.hoje(), date(2026, 1, 31))
            self.assertEqual(indicadores.resumo_painel()['doacoes_mes']['value'], 75.0)

    def test_mes_anterior_zero_tendencia_nula(self):
        criar_doacao(valor=Decimal('10'), data=date(2026, 3, 5))
        with relogio(2026, 3, 10):
            resumo = indicadores.resumo_painel()
        self.assertIsNone(resumo['doacoes_mes']['trend_percentage'])
        self.assertEqual(resumo['doacoes_mes']['trend_direction'], 'neutral')
        self.assertIsNone(resumo['total_arrecadado']['trend_percentage'])

    def test_doacoes_pendentes_e_canceladas_fora_dos_totais(self):
        criar_doacao(valor=Decimal('10'), data=date(2026, 3, 5))
        criar_doacao(valor=Decimal('99'), data=date(2026, 3, 5), status='pendente')
        criar_doacao(valor=Decimal('99'), data=date(2026, 3, 5), status='cancelada')
        with relogio(2026, 3, 10):
            self.assertEqual(indicadores.resumo_painel()['doacoes_mes']['value'], 10.0)

    def test_despesa_paga_em_mes_diferente_do_vencimento(self):
        criar_despesa(valor=Decimal('300'), data_vencimento=date(2026, 1, 25), status='pago',
                      data_pagamento=date(2026, 2, 3))
        criar_despesa(valor=Decimal('50'), data_vencimento=date(2026, 2, 20), status='pendente')
        criar_despesa(valor=Decimal('20'), data_vencimento=date(2026, 1, 10), status='pendente')
        with relogio(2026, 1, 28):
            janeiro = indicadores.resumo_despesas()
        with relogio(2026, 2, 15):
            fevereiro = indicadores.resumo_despesas()
        self.assertEqual(janeiro['gasto_mes'], 0.0)
        self.assertEqual(fevereiro['gasto_mes'], 300.0)
        self.assertEqual(fevereiro['a_pagar_mes'], 50.0)
        self.assertEqual(fevereiro['total_pendente'], 70.0)
        self.assertEqual(fevereiro['total_atrasado'], 20.0)

    def test_membros_ativos_comparam_mesma_regra(self):
        antigo, novo, inativo = criar_membro(), criar_membro(), criar_membro(status='inativo')
        Apoiador.objects.filter(pk=antigo.pk).update(data_cadastro=date(2026, 1, 15))
        Apoiador.objects.filter(pk__in=[novo.pk, inativo.pk]).update(data_cadastro=date(2026, 2, 5))
        with relogio(2026, 2, 10):
            resumo = indicadores.resumo_painel()
        self.assertEqual(resumo['apoiadores_ativos']['value'], 2)
        self.assertEqual(resumo['apoiadores_ativos']['trend_percentage'], 100.0)


class RegrasDeDataNaApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())

    def test_doacao_com_data_futura_400(self):
        membro = criar_membro()
        with relogio(2026, 5, 10):
            resp = self.client.post('/api/doacoes/', {
                'apoiador': membro.pk, 'valor': '10', 'data': '2026-05-11', 'status': 'confirmada',
            }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('data', resp.data)

    def test_marcar_como_paga_preenche_data_de_pagamento(self):
        despesa = criar_despesa()
        with relogio(2026, 5, 10):
            resp = self.client.patch(f'/api/despesas/{despesa.pk}/', {'status': 'pago'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['data_pagamento'], '2026-05-10')

    def test_status_atrasado_nao_e_mais_gravado(self):
        resp = self.client.post('/api/despesas/', {
            'descricao': 'X', 'valor': '10', 'data_vencimento': '2026-01-10', 'categoria': 'outros', 'status': 'atrasado',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)

    def test_filtro_atrasado_significa_pendente_vencida(self):
        criar_despesa(descricao='Vencida', data_vencimento=date(2026, 5, 1))
        criar_despesa(descricao='No prazo', data_vencimento=date(2026, 5, 20))
        criar_despesa(descricao='Paga', data_vencimento=date(2026, 5, 1), status='pago', data_pagamento=date(2026, 5, 1))
        with relogio(2026, 5, 10):
            resp = self.client.get('/api/despesas/?status=atrasado')
        self.assertEqual([d['descricao'] for d in resp.data['results']], ['Vencida'])
        self.assertEqual(resp.data['results'][0]['status_efetivo'], 'atrasado')

    def test_portal_usa_os_mesmos_indicadores(self):
        criar_doacao(valor=Decimal('25'), data=date(2026, 5, 2))
        criar_despesa(valor=Decimal('8'), status='pago', data_vencimento=date(2026, 4, 30), data_pagamento=date(2026, 5, 3))
        self.client.force_authenticate(None)
        with relogio(2026, 5, 10):
            kpis = self.client.get('/api/public/transparencia/').data['kpis']
        self.assertEqual(kpis['doacoes_mes'], 25.0)
        self.assertEqual(kpis['gastos_mes'], 8.0)
