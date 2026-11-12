from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from core import indicadores
from core.models import Despesa
from core.tests.factories import criar_despesa, criar_staff
from core.tests.test_indicadores import relogio


def fixa(vencimento, periodo='mensal', **kwargs):
    return criar_despesa(data_vencimento=vencimento, is_fixed=True, recurrence_period=periodo, **kwargs)


def pagar_e_gerar(despesa):
    despesa.status = 'pago'
    despesa.data_pagamento = despesa.data_vencimento
    despesa.save()
    return despesa.gerar_proxima_recorrencia()


class SerieAncoraTests(TestCase):
    def test_mensal_a_partir_de_31_01(self):
        atual = fixa(date(2026, 1, 31))
        vencimentos = []
        for _ in range(3):
            atual = pagar_e_gerar(atual)
            vencimentos.append(atual.data_vencimento)
        self.assertEqual(vencimentos, [date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)])
        self.assertEqual(atual.numero_ocorrencia, 3)

    def test_mensal_em_ano_bissexto(self):
        self.assertEqual(pagar_e_gerar(fixa(date(2028, 1, 31))).data_vencimento, date(2028, 2, 29))

    def test_anual_em_29_02(self):
        atual = fixa(date(2028, 2, 29), periodo='anual')
        datas = []
        for _ in range(4):
            atual = pagar_e_gerar(atual)
            datas.append(atual.data_vencimento)
        self.assertEqual(datas, [date(2029, 2, 28), date(2030, 2, 28), date(2031, 2, 28), date(2032, 2, 29)])

    def test_semanal(self):
        segunda = pagar_e_gerar(fixa(date(2026, 1, 1), periodo='semanal'))
        terceira = pagar_e_gerar(segunda)
        self.assertEqual((segunda.data_vencimento, terceira.data_vencimento), (date(2026, 1, 8), date(2026, 1, 15)))

    def test_nao_gera_depois_do_fim_da_serie(self):
        atual = fixa(date(2026, 1, 10), recorrencia_fim=date(2026, 2, 15))
        segunda = pagar_e_gerar(atual)
        self.assertEqual(segunda.data_vencimento, date(2026, 2, 10))
        self.assertIsNone(pagar_e_gerar(segunda))

    def test_dedupe_por_serie_e_numero(self):
        atual = fixa(date(2026, 1, 10))
        primeira = pagar_e_gerar(atual)
        self.assertIsNotNone(primeira)
        self.assertIsNone(atual.gerar_proxima_recorrencia())
        self.assertEqual(Despesa.objects.filter(serie_id=atual.serie_id).count(), 2)

    def test_mesma_descricao_em_series_diferentes_nao_colidem(self):
        a = fixa(date(2026, 1, 10), descricao='Aluguel')
        b = fixa(date(2026, 1, 10), descricao='Aluguel')
        self.assertNotEqual(a.serie_id, b.serie_id)
        self.assertIsNotNone(pagar_e_gerar(a))
        self.assertIsNotNone(pagar_e_gerar(b))

    def test_encerrar_serie_apaga_pendentes_futuras(self):
        atual = fixa(date(2026, 1, 10))
        segunda = pagar_e_gerar(atual)
        terceira = pagar_e_gerar(segunda)
        segunda.refresh_from_db()
        apagadas = segunda.encerrar_serie(date(2026, 2, 10))
        self.assertEqual(apagadas, 1)
        self.assertFalse(Despesa.objects.filter(pk=terceira.pk).exists())
        self.assertTrue(all(d.recorrencia_fim == date(2026, 2, 10) for d in Despesa.objects.filter(serie_id=atual.serie_id)))

    def test_aplicar_valor_as_proximas(self):
        atual = fixa(date(2026, 1, 10), valor=Decimal('100'))
        segunda = pagar_e_gerar(atual)
        segunda.valor = Decimal('130')
        segunda.save()
        Despesa.objects.filter(pk=atual.pk).update(status='pago')
        terceira = Despesa.objects.create(
            descricao=segunda.descricao, valor=Decimal('100'), categoria='outros', data_vencimento=date(2026, 3, 10),
            is_fixed=True, recurrence_period='mensal', serie_id=atual.serie_id, data_ancora=atual.data_ancora,
            numero_ocorrencia=2,
        )
        self.assertEqual(segunda.aplicar_valor_as_proximas(), 1)
        terceira.refresh_from_db()
        atual.refresh_from_db()
        self.assertEqual((terceira.valor, atual.valor), (Decimal('130'), Decimal('100')))

    def test_cancelado_fora_dos_totais(self):
        criar_despesa(valor=Decimal('70'), status='cancelado', data_vencimento=date(2026, 5, 5))
        criar_despesa(valor=Decimal('30'), status='pendente', data_vencimento=date(2026, 5, 5))
        with relogio(2026, 5, 10):
            resumo = indicadores.resumo_despesas()
        self.assertEqual((resumo['a_pagar_mes'], resumo['total_pendente'], resumo['gasto_mes']), (30.0, 30.0, 0.0))


class RecorrenciaApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())

    def _criar_fixa(self):
        resp = self.client.post('/api/despesas/', {
            'descricao': 'Aluguel', 'valor': '900', 'data_vencimento': '2026-01-31', 'categoria': 'administrativo',
            'status': 'pendente', 'is_fixed': 'true', 'recurrence_period': 'mensal',
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        return resp.data

    def test_cadastro_nao_gera_ocorrencia_e_pagamento_gera(self):
        criada = self._criar_fixa()
        self.assertEqual(Despesa.objects.count(), 1)
        self.assertEqual(criada['numero_ocorrencia'], 0)
        self.client.patch(f"/api/despesas/{criada['id']}/", {'status': 'pago'}, format='json')
        proxima = Despesa.objects.get(numero_ocorrencia=1)
        self.assertEqual(proxima.data_vencimento, date(2026, 2, 28))

    def test_voltar_para_pendente_limpa_pagamento_sem_apagar_nada(self):
        criada = self._criar_fixa()
        self.client.patch(f"/api/despesas/{criada['id']}/", {'status': 'pago', 'data_pagamento': '2026-01-30'}, format='json')
        resp = self.client.patch(f"/api/despesas/{criada['id']}/", {'status': 'pendente'}, format='json')
        self.assertIsNone(resp.data['data_pagamento'])
        self.assertEqual(Despesa.objects.count(), 2)

    def test_encerrar_serie_pela_api(self):
        criada = self._criar_fixa()
        self.client.patch(f"/api/despesas/{criada['id']}/", {'status': 'pago'}, format='json')
        resp = self.client.post(f"/api/despesas/{criada['id']}/encerrar-serie/", {}, format='json')
        self.assertEqual(resp.data, {'recorrencia_fim': '2026-01-31', 'ocorrencias_apagadas': 1})
        self.assertEqual(Despesa.objects.count(), 1)

    def test_acoes_de_serie_exigem_serie(self):
        avulsa = criar_despesa()
        self.assertEqual(self.client.post(f'/api/despesas/{avulsa.pk}/encerrar-serie/', {}, format='json').status_code, 400)
        self.assertEqual(self.client.post(f'/api/despesas/{avulsa.pk}/aplicar-valor-proximas/', {}, format='json').status_code, 400)
