from unittest import mock

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from core.tests.factories import criar_staff, criar_usuario

URL = '/api/auth/google/'
VERIFICADOR = 'core.views.google_id_token.verify_oauth2_token'


@override_settings(GOOGLE_CLIENT_ID='cliente-teste.apps.googleusercontent.com')
class GoogleLoginTests(APITestCase):
    def setUp(self):
        cache.clear()

    def _info(self, email='admin@ong.org', verificado=True):
        return {'email': email, 'email_verified': verificado}

    def test_ataque_antigo_so_com_email_e_recusado(self):
        resp = self.client.post(URL, {'email': 'admin@ong.org', 'nome': 'Invasor'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertNotIn('access', resp.data)

    def test_sem_token_400(self):
        self.assertEqual(self.client.post(URL, {}, format='json').status_code, 400)

    def test_token_invalido_401(self):
        with mock.patch(VERIFICADOR, side_effect=ValueError('assinatura inválida')):
            resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_email_nao_verificado_401(self):
        criar_staff(email='admin@ong.org')
        with mock.patch(VERIFICADOR, return_value=self._info(verificado=False)):
            resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_email_sem_usuario_403_e_nao_cria_usuario(self):
        from django.contrib.auth import get_user_model
        antes = get_user_model().objects.count()
        with mock.patch(VERIFICADOR, return_value=self._info('desconhecido@exemplo.org')):
            resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(resp.data['erro'], 'Conta não autorizada. Peça acesso a um administrador.')
        self.assertEqual(get_user_model().objects.count(), antes)

    def test_usuario_nao_staff_403(self):
        criar_usuario(email='comum@ong.org')
        with mock.patch(VERIFICADOR, return_value=self._info('comum@ong.org')):
            resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_usuario_inativo_403(self):
        criar_staff(email='inativo@ong.org', is_active=False)
        with mock.patch(VERIFICADOR, return_value=self._info('inativo@ong.org')):
            resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 403)

    def test_staff_valido_200_com_tokens(self):
        criar_staff(email='Admin@ONG.org')
        with mock.patch(VERIFICADOR, return_value=self._info('admin@ong.org')) as verif:
            resp = self.client.post(URL, {'credential': 'token-google'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)
        self.assertIn('refresh', resp.data)
        self.assertEqual(verif.call_args.args[0], 'token-google')
        self.assertEqual(verif.call_args.args[2], 'cliente-teste.apps.googleusercontent.com')

    @override_settings(GOOGLE_CLIENT_ID='')
    def test_sem_client_id_configurado_503(self):
        resp = self.client.post(URL, {'credential': 'xyz'}, format='json')
        self.assertEqual(resp.status_code, 503)
