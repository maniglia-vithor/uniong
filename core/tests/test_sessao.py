from django.core.cache import cache
from rest_framework.test import APITestCase

from core.tests.factories import criar_campanha, criar_staff

SENHA = 'senha-forte-123'


class ThrottlingTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_login_bloqueia_apos_10_tentativas_por_minuto(self):
        dados = {'username': 'ninguem', 'password': 'errada'}
        for _ in range(10):
            self.assertEqual(self.client.post('/api/auth/token/', dados, format='json').status_code, 401)
        self.assertEqual(self.client.post('/api/auth/token/', dados, format='json').status_code, 429)

    def test_login_google_tem_limite(self):
        for _ in range(10):
            self.client.post('/api/auth/google/', {}, format='json')
        self.assertEqual(self.client.post('/api/auth/google/', {}, format='json').status_code, 429)

    def test_doacao_publica_bloqueia_apos_5_por_minuto(self):
        campanha = criar_campanha()
        dados = {'nome': 'Ana', 'email': 'ana@exemplo.org', 'campaign_id': campanha.id, 'valor': '10', 'consentimento': True}
        for _ in range(5):
            self.assertEqual(self.client.post('/api/public/doacoes/', dados, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/public/doacoes/', dados, format='json').status_code, 429)

    def test_limite_e_por_ip(self):
        dados = {'username': 'ninguem', 'password': 'errada'}
        for _ in range(10):
            self.client.post('/api/auth/token/', dados, format='json', REMOTE_ADDR='10.0.0.1')
        self.assertEqual(
            self.client.post('/api/auth/token/', dados, format='json', REMOTE_ADDR='10.0.0.2').status_code, 401
        )


class LogoutTests(APITestCase):
    def setUp(self):
        cache.clear()
        criar_staff(username='equipe', password=SENHA)
        resp = self.client.post('/api/auth/token/', {'username': 'equipe', 'password': SENHA}, format='json')
        self.refresh = resp.data['refresh']

    def test_refresh_apos_logout_401(self):
        resp = self.client.post('/api/auth/logout/', {'refresh': self.refresh}, format='json')
        self.assertEqual(resp.status_code, 205)
        resp = self.client.post('/api/auth/token/refresh/', {'refresh': self.refresh}, format='json')
        self.assertEqual(resp.status_code, 401)

    def test_logout_sem_token_400(self):
        self.assertEqual(self.client.post('/api/auth/logout/', {}, format='json').status_code, 400)

    def test_logout_repetido_400(self):
        self.client.post('/api/auth/logout/', {'refresh': self.refresh}, format='json')
        self.assertEqual(self.client.post('/api/auth/logout/', {'refresh': self.refresh}, format='json').status_code, 400)

    def test_refresh_rotacionado_invalida_o_anterior(self):
        resp = self.client.post('/api/auth/token/refresh/', {'refresh': self.refresh}, format='json')
        self.assertEqual(resp.status_code, 200)
        novo = resp.data['refresh']
        self.assertNotEqual(novo, self.refresh)
        self.assertEqual(
            self.client.post('/api/auth/token/refresh/', {'refresh': self.refresh}, format='json').status_code, 401
        )
        self.assertEqual(
            self.client.post('/api/auth/token/refresh/', {'refresh': novo}, format='json').status_code, 200
        )
