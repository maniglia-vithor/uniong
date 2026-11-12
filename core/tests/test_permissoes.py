from django.core.cache import cache
from rest_framework.test import APITestCase

from core.tests.factories import criar_staff, criar_usuario

ROTAS_LEITURA = [
    '/api/',
    '/api/apoiadores/',
    '/api/campanhas/',
    '/api/doacoes/',
    '/api/despesas/',
    '/api/despesas/resumo/',
    '/api/despesas/por-categoria/',
    '/api/comunicados/',
    '/api/notificacoes/',
    '/api/configuracoes/pix/',
    '/api/dashboard/resumo/',
    '/api/dashboard/grafico-mensal/',
    '/api/dashboard/doacoes-recentes/',
    '/api/dashboard/top-apoiadores/',
    '/api/dashboard/campanhas-ativas/',
    '/api/dashboard/kpi-doacoes/',
    '/api/dashboard/kpi-doacoes-mes/',
    '/api/dashboard/kpi-apoiadores-ativos/',
    '/api/dashboard/kpi-campanhas-ativas/',
    '/api/dashboard/doacoes-por-mes/?mes=2026-01',
    '/api/relatorios/doacoes/',
    '/api/relatorios/campanhas/',
    '/api/relatorios/apoiadores/',
]

ROTAS_ESCRITA = [
    ('post', '/api/apoiadores/', {'nome': 'X', 'email': 'x@exemplo.org'}),
    ('post', '/api/comunicados/', {'titulo': 'T', 'conteudo': 'C'}),
    ('put', '/api/configuracoes/pix/', {'chave': '', 'nome_recebedor': '', 'cidade': ''}),
]


class AutorizacaoPorPerfilTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = criar_staff()
        self.comum = criar_usuario()

    def test_leitura_anonimo_401_comum_403_staff_200(self):
        for url in ROTAS_LEITURA:
            with self.subTest(url=url, perfil='anonimo'):
                self.client.force_authenticate(None)
                self.assertEqual(self.client.get(url).status_code, 401)
            with self.subTest(url=url, perfil='comum'):
                self.client.force_authenticate(self.comum)
                self.assertEqual(self.client.get(url).status_code, 403)
            with self.subTest(url=url, perfil='staff'):
                self.client.force_authenticate(self.staff)
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_escrita_anonimo_401_comum_403(self):
        for metodo, url, dados in ROTAS_ESCRITA:
            with self.subTest(url=url, perfil='anonimo'):
                self.client.force_authenticate(None)
                self.assertEqual(getattr(self.client, metodo)(url, dados, format='json').status_code, 401)
            with self.subTest(url=url, perfil='comum'):
                self.client.force_authenticate(self.comum)
                self.assertEqual(getattr(self.client, metodo)(url, dados, format='json').status_code, 403)

    def test_rotas_publicas_continuam_abertas(self):
        self.assertEqual(self.client.get('/api/public/transparencia/').status_code, 200)


class TokenEMeTests(APITestCase):
    def setUp(self):
        cache.clear()

    def test_token_recusa_usuario_nao_staff(self):
        criar_usuario(username='comum', password='senha-forte-123')
        resp = self.client.post('/api/auth/token/', {'username': 'comum', 'password': 'senha-forte-123'}, format='json')
        self.assertEqual(resp.status_code, 401)
        self.assertNotIn('access', resp.data)

    def test_token_aceita_staff(self):
        criar_staff(username='equipe', password='senha-forte-123')
        resp = self.client.post('/api/auth/token/', {'username': 'equipe', 'password': 'senha-forte-123'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('access', resp.data)

    def test_me_devolve_dados_do_usuario(self):
        staff = criar_staff(first_name='Ana', last_name='Lima', email='ana@ong.org', is_superuser=True)
        self.client.force_authenticate(staff)
        resp = self.client.get('/api/auth/me/')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['nome'], 'Ana Lima')
        self.assertEqual(resp.data['email'], 'ana@ong.org')
        self.assertTrue(resp.data['is_staff'])
        self.assertTrue(resp.data['is_superuser'])
        self.assertEqual(resp.data['id'], staff.id)

    def test_me_anonimo_401(self):
        self.assertEqual(self.client.get('/api/auth/me/').status_code, 401)
