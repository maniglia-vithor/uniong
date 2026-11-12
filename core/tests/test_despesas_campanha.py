from datetime import date
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Campanha
from core.tests.factories import criar_campanha, criar_despesa, criar_doacao, criar_staff

PAGA = {'status': 'pago', 'data_vencimento': date(2026, 3, 1), 'data_pagamento': date(2026, 3, 2)}


class DespesasDeCampanhaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        self.camp = criar_campanha(titulo='Agasalho')
        criar_doacao(campanha=self.camp, valor=Decimal('500'))
        criar_doacao(campanha=self.camp, valor=Decimal('200'))
        criar_despesa(campanha=self.camp, valor=Decimal('120'), **PAGA)
        criar_despesa(campanha=self.camp, valor=Decimal('80'), **PAGA)
        criar_despesa(campanha=self.camp, valor=Decimal('999'), status='pendente')

    def test_arrecadado_gasto_e_saldo_sem_duplicar_somas(self):
        c = Campanha.objects.com_arrecadado().get(pk=self.camp.pk)
        self.assertEqual((c.arrecadado, c.gasto, c.saldo), (Decimal('700'), Decimal('200'), Decimal('500')))

    def test_api_da_campanha_e_lista_de_despesas(self):
        resp = self.client.get(f'/api/campanhas/{self.camp.pk}/')
        self.assertEqual((resp.data['valor_arrecadado'], resp.data['valor_gasto'], resp.data['saldo']), ('700.00', '200.00', '500.00'))
        despesas = self.client.get(f'/api/campanhas/{self.camp.pk}/despesas/').data
        self.assertEqual(sorted(d['valor'] for d in despesas), ['120.00', '80.00'])

    def test_vincular_despesa_a_campanha_encerrada(self):
        encerrada = criar_campanha(status='encerrada')
        resp = self.client.post('/api/despesas/', {
            'descricao': 'Frete', 'valor': '30', 'data_vencimento': '2026-03-05', 'categoria': 'projetos',
            'status': 'pendente', 'campanha': encerrada.pk,
        }, format='multipart')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['campanha_titulo'], encerrada.titulo)

    def test_opcoes_com_encerradas(self):
        criar_campanha(titulo='Antiga', status='encerrada')
        padrao = [c['titulo'] for c in self.client.get('/api/campanhas/opcoes/').data]
        todas = [c['titulo'] for c in self.client.get('/api/campanhas/opcoes/?incluir_encerradas=1').data]
        self.assertNotIn('Antiga', padrao)
        self.assertIn('Antiga', todas)

    def test_campanha_com_despesa_nao_pode_ser_excluida(self):
        camp = criar_campanha()
        criar_despesa(campanha=camp)
        resp = self.client.delete(f'/api/campanhas/{camp.pk}/')
        self.assertEqual(resp.status_code, 400)
