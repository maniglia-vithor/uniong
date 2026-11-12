from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Doacao
from core.tests.factories import criar_doacao, criar_membro, criar_staff, criar_usuario

URL = '/api/doacoes/acao-em-lote/'


class AcaoEmLoteTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        self.interessado = criar_membro(status='interessado')
        self.p1 = criar_doacao(status='pendente', apoiador=self.interessado)
        self.p2 = criar_doacao(status='pendente')
        self.confirmada = criar_doacao(status='confirmada')

    def test_confirmar_em_lote(self):
        resp = self.client.post(URL, {'ids': [self.p1.id, self.p2.id, self.confirmada.id], 'acao': 'confirmar'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, {'atualizadas': 2, 'ignoradas': 1})
        self.assertEqual(Doacao.objects.filter(status='confirmada').count(), 3)
        self.interessado.refresh_from_db()
        self.assertEqual(self.interessado.status, 'ativo')

    def test_cancelar_em_lote_so_afeta_pendentes(self):
        resp = self.client.post(URL, {'ids': [self.p1.id, self.confirmada.id], 'acao': 'cancelar'}, format='json')
        self.assertEqual(resp.data['atualizadas'], 1)
        self.p1.refresh_from_db()
        self.confirmada.refresh_from_db()
        self.assertEqual((self.p1.status, self.confirmada.status), ('cancelada', 'confirmada'))
        self.interessado.refresh_from_db()
        self.assertEqual(self.interessado.status, 'interessado')

    def test_entrada_invalida(self):
        self.assertEqual(self.client.post(URL, {'ids': [self.p1.id], 'acao': 'apagar'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(URL, {'ids': [], 'acao': 'confirmar'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(URL, {'ids': ['x'], 'acao': 'confirmar'}, format='json').status_code, 400)

    def test_exige_staff(self):
        self.client.force_authenticate(criar_usuario())
        self.assertEqual(self.client.post(URL, {'ids': [self.p1.id], 'acao': 'confirmar'}, format='json').status_code, 403)

    def test_contador_de_pendentes(self):
        self.assertEqual(self.client.get('/api/doacoes/resumo/?status=pendente').data['quantidade'], 2)
