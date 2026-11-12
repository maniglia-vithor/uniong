from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Campanha, Notificacao
from core.tests.factories import criar_staff


class CriacaoCampanhaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = criar_staff()
        self.client.force_authenticate(self.staff)

    def test_post_cria_campanha_e_notificacao(self):
        resp = self.client.post('/api/campanhas/', {
            'titulo': 'Agasalho', 'meta_valor': '1500.00', 'status': 'ativa', 'data_inicio': '2026-01-01',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Campanha.objects.count(), 1)
        notif = Notificacao.objects.get(tipo='campanha')
        self.assertIn('Meta: R$ 1500,00', notif.action_text)
        self.assertEqual(notif.target_id, resp.data['id'])
