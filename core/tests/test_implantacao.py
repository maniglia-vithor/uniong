from unittest import mock

from django.test import TestCase


class ImplantacaoTests(TestCase):
    def test_health_anonimo_sem_dados(self):
        r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {'status': 'ok'})

    def test_health_com_banco_fora(self):
        from core.saude import banco_disponivel
        with mock.patch('core.saude.connection') as conexao:
            conexao.cursor.side_effect = Exception('fora')
            self.assertFalse(banco_disponivel())
        with mock.patch('core.saude.banco_disponivel', return_value=False):
            r = self.client.get('/api/health/')
        self.assertEqual(r.status_code, 503)

    def test_admin_do_django_movido(self):
        self.assertEqual(self.client.get('/admin-django/').status_code, 302)
        self.assertEqual(self.client.get('/admin/').status_code, 404)
