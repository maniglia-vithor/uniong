from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import ConfiguracaoInstituicao, LogAlteracao
from core.tests.factories import criar_campanha, criar_staff, criar_usuario

SENHA = 'senha-forte-123'


class PerfilESenhaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = criar_staff(username='equipe', password=SENHA, email='equipe@ong.org')
        self.client.force_authenticate(self.staff)

    def test_patch_me_altera_nome_e_email(self):
        resp = self.client.patch('/api/auth/me/', {'nome': 'Maria Clara Souza', 'email': ' Maria@ONG.org '}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.staff.refresh_from_db()
        self.assertEqual((self.staff.first_name, self.staff.last_name, self.staff.email), ('Maria', 'Clara Souza', 'maria@ong.org'))
        self.assertEqual(resp.data['nome'], 'Maria Clara Souza')

    def test_patch_me_email_duplicado(self):
        criar_usuario(email='outro@ong.org')
        resp = self.client.patch('/api/auth/me/', {'email': 'OUTRO@ong.org'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_alterar_senha_com_senha_atual_errada_400(self):
        resp = self.client.post('/api/auth/alterar-senha/', {'senha_atual': 'errada', 'nova_senha': 'NovaSenha!2026'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('senha_atual', resp.data)

    def test_alterar_senha_aplica_validadores_do_django(self):
        resp = self.client.post('/api/auth/alterar-senha/', {'senha_atual': SENHA, 'nova_senha': '123'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('nova_senha', resp.data)

    def test_alterar_senha_ok(self):
        resp = self.client.post('/api/auth/alterar-senha/', {'senha_atual': SENHA, 'nova_senha': 'NovaSenha!2026'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password('NovaSenha!2026'))


class PortalAtivoTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.super = criar_staff(is_superuser=True)
        self.staff = criar_staff()

    def test_portal_desligado_404(self):
        ConfiguracaoInstituicao.objects.create(pk=1, portal_ativo=False)
        self.assertEqual(self.client.get('/api/public/transparencia/').status_code, 404)
        camp = criar_campanha()
        resp = self.client.post('/api/public/doacoes/', {
            'nome': 'Ana', 'email': 'a@x.org', 'valor': '10', 'consentimento': True, 'campaign_id': camp.id,
        }, format='json')
        self.assertEqual(resp.status_code, 404)

    def test_so_superuser_altera_e_gera_log(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get('/api/configuracoes/instituicao/').data['portal_ativo'], True)
        self.assertEqual(self.client.patch('/api/configuracoes/instituicao/', {'portal_ativo': False}, format='json').status_code, 403)
        self.client.force_authenticate(self.super)
        resp = self.client.patch('/api/configuracoes/instituicao/', {'portal_ativo': False}, format='json')
        self.assertIs(resp.data['portal_ativo'], False)
        self.assertTrue(LogAlteracao.objects.filter(modelo='ConfiguracaoInstituicao', campo='portal_ativo').exists())
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/public/transparencia/').status_code, 404)
