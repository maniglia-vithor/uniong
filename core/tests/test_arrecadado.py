from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from core.models import Campanha, Doacao
from core.tests.factories import criar_campanha, criar_doacao, criar_staff


def arrecadado(campanha):
    return Campanha.objects.com_arrecadado().get(pk=campanha.pk).arrecadado


class ArrecadadoCalculadoTests(TestCase):
    def setUp(self):
        self.camp = criar_campanha(meta_valor=Decimal('1000'))
        self.outra = criar_campanha()

    def test_criar_confirmada_soma(self):
        criar_doacao(campanha=self.camp, valor=Decimal('150'), status='confirmada')
        self.assertEqual(arrecadado(self.camp), Decimal('150'))

    def test_criar_pendente_nao_soma(self):
        criar_doacao(campanha=self.camp, valor=Decimal('150'), status='pendente')
        self.assertEqual(arrecadado(self.camp), Decimal('0'))

    def test_pendente_para_confirmada(self):
        d = criar_doacao(campanha=self.camp, valor=Decimal('80'), status='pendente')
        d.status = 'confirmada'
        d.save()
        self.assertEqual(arrecadado(self.camp), Decimal('80'))

    def test_confirmada_para_cancelada(self):
        d = criar_doacao(campanha=self.camp, valor=Decimal('80'), status='confirmada')
        d.status = 'cancelada'
        d.save()
        self.assertEqual(arrecadado(self.camp), Decimal('0'))

    def test_excluir_doacao(self):
        criar_doacao(campanha=self.camp, valor=Decimal('30'))
        d = criar_doacao(campanha=self.camp, valor=Decimal('50'))
        d.delete()
        self.assertEqual(arrecadado(self.camp), Decimal('30'))

    def test_mover_doacao_entre_campanhas(self):
        d = criar_doacao(campanha=self.camp, valor=Decimal('70'))
        d.campanha = self.outra
        d.save()
        self.assertEqual(arrecadado(self.camp), Decimal('0'))
        self.assertEqual(arrecadado(self.outra), Decimal('70'))

    def test_exclusao_em_lote(self):
        criar_doacao(campanha=self.camp, valor=Decimal('10'))
        criar_doacao(campanha=self.camp, valor=Decimal('20'))
        criar_doacao(campanha=self.camp, valor=Decimal('25'))
        Doacao.objects.filter(campanha=self.camp, valor__lt=Decimal('25')).delete()
        self.assertEqual(arrecadado(self.camp), Decimal('25'))

    def test_campanha_sem_anotacao_calcula_pela_propriedade(self):
        criar_doacao(campanha=self.camp, valor=Decimal('40'))
        self.assertEqual(Campanha.objects.get(pk=self.camp.pk).valor_arrecadado, Decimal('40'))

    def test_percentual_real_e_meta_atingida(self):
        criar_doacao(campanha=self.camp, valor=Decimal('1250'))
        c = Campanha.objects.com_arrecadado().get(pk=self.camp.pk)
        self.assertEqual(c.percentual_progresso, Decimal('125.0'))
        self.assertTrue(c.meta_atingida)


class ArrecadadoNaApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        self.camp = criar_campanha(meta_valor=Decimal('100'))
        criar_doacao(campanha=self.camp, valor=Decimal('60'))
        criar_doacao(campanha=self.camp, valor=Decimal('60'))
        criar_doacao(campanha=self.camp, valor=Decimal('999'), status='pendente')

    def test_api_devolve_valor_calculado_e_somente_leitura(self):
        resp = self.client.get(f'/api/campanhas/{self.camp.pk}/')
        self.assertEqual(resp.data['valor_arrecadado'], '120.00')
        self.assertEqual(resp.data['percentual_progresso'], Decimal('120.0'))
        self.assertTrue(resp.data['meta_atingida'])
        resp = self.client.patch(f'/api/campanhas/{self.camp.pk}/', {'valor_arrecadado': '5'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['valor_arrecadado'], '120.00')

    def test_portal_e_relatorio_usam_valor_calculado(self):
        self.client.force_authenticate(None)
        camp = self.client.get('/api/public/transparencia/').data['campanhas'][0]
        self.assertEqual(camp['valor_arrecadado'], '120.00')
