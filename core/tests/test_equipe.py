import re
from datetime import datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.equipe import convite_token

from .factories import criar_staff

Usuario = get_user_model()


def _link(corpo):
    uid, token = re.search(r'/definir-senha/([^/\s]+)/([^/\s]+)', corpo).groups()
    return uid, token


@override_settings(FRONTEND_URL='http://painel.exemplo.org')
class EquipeTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = criar_staff(is_superuser=True)
        self.cliente = APIClient()
        self.cliente.force_authenticate(self.admin)

    def convidar(self, **extra):
        dados = {'nome': 'Ana Souza', 'email': 'Ana@Exemplo.org', 'superusuario': False, **extra}
        return self.cliente.post('/api/equipe/convidar/', dados, format='json')

    def test_operador_nao_gerencia_equipe(self):
        operador = criar_staff()
        cliente = APIClient()
        cliente.force_authenticate(operador)
        self.assertEqual(cliente.get('/api/equipe/').status_code, 403)
        self.assertEqual(cliente.post('/api/equipe/convidar/', {}, format='json').status_code, 403)

    def test_convite_cria_usuario_inativo_e_envia_link(self):
        r = self.convidar()
        self.assertEqual(r.status_code, 201, r.data)
        novo = Usuario.objects.get(email='ana@exemplo.org')
        self.assertTrue(novo.is_staff)
        self.assertFalse(novo.is_active)
        self.assertFalse(novo.has_usable_password())
        self.assertTrue(r.data['convite_pendente'])
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ana@exemplo.org'])
        self.assertIn('http://painel.exemplo.org/definir-senha/', mail.outbox[0].body)

    def test_email_repetido_e_recusado(self):
        criar_staff(email='ana@exemplo.org')
        self.assertEqual(self.convidar().status_code, 400)

    def test_ativacao_pelo_link(self):
        self.convidar()
        uid, token = _link(mail.outbox[0].body)
        anonimo = APIClient()
        r = anonimo.post('/api/auth/ativar-convite/', {'uid': uid, 'token': token, 'senha': 'Senha-Forte-2026'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        novo = Usuario.objects.get(email='ana@exemplo.org')
        self.assertTrue(novo.is_active)
        self.assertTrue(novo.check_password('Senha-Forte-2026'))
        # o link não serve uma segunda vez
        r = anonimo.post('/api/auth/ativar-convite/', {'uid': uid, 'token': token, 'senha': 'Outra-Senha-2026'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_senha_fraca_e_recusada(self):
        self.convidar()
        uid, token = _link(mail.outbox[0].body)
        r = APIClient().post('/api/auth/ativar-convite/', {'uid': uid, 'token': token, 'senha': '123'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('senha', r.data)

    def test_link_expira_em_72_horas(self):
        self.convidar()
        uid, token = _link(mail.outbox[0].body)
        depois = datetime.now() + timedelta(hours=73)
        with mock.patch.object(type(convite_token), '_now', return_value=depois):
            r = APIClient().post('/api/auth/ativar-convite/', {'uid': uid, 'token': token, 'senha': 'Senha-Forte-2026'}, format='json')
        self.assertEqual(r.status_code, 400)
        dentro = datetime.now() + timedelta(hours=71)
        with mock.patch.object(type(convite_token), '_now', return_value=dentro):
            r = APIClient().post('/api/auth/ativar-convite/', {'uid': uid, 'token': token, 'senha': 'Senha-Forte-2026'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_token_de_convite_nao_vale_como_redefinicao(self):
        from django.contrib.auth.tokens import default_token_generator
        self.convidar()
        _, token = _link(mail.outbox[0].body)
        novo = Usuario.objects.get(email='ana@exemplo.org')
        self.assertFalse(default_token_generator.check_token(novo, token))

    def test_nao_desativa_o_ultimo_superusuario(self):
        r = self.cliente.patch(f'/api/equipe/{self.admin.id}/acesso/', {'is_active': False}, format='json')
        self.assertEqual(r.status_code, 400)
        r = self.cliente.patch(f'/api/equipe/{self.admin.id}/acesso/', {'is_superuser': False}, format='json')
        self.assertEqual(r.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active and self.admin.is_superuser)

    def test_desativa_superusuario_quando_ha_outro(self):
        outro = criar_staff(is_superuser=True)
        r = self.cliente.patch(f'/api/equipe/{outro.id}/acesso/', {'is_active': False}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        outro.refresh_from_db()
        self.assertFalse(outro.is_active)

    def test_nao_ativa_convite_pendente_sem_senha(self):
        self.convidar()
        novo = Usuario.objects.get(email='ana@exemplo.org')
        r = self.cliente.patch(f'/api/equipe/{novo.id}/acesso/', {'is_active': True}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_reenviar_convite(self):
        self.convidar()
        novo = Usuario.objects.get(email='ana@exemplo.org')
        r = self.cliente.post(f'/api/equipe/{novo.id}/reenviar-convite/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)


def _link_redefinicao(corpo):
    return re.search(r'/redefinir-senha/([^/\s]+)/([^/\s]+)', corpo).groups()


@override_settings(FRONTEND_URL='http://painel.exemplo.org')
class RecuperacaoSenhaTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.staff = criar_staff(email='equipe@exemplo.org', first_name='Bia')

    def pedir(self, email):
        return self.cliente.post('/api/auth/recuperar-senha/', {'email': email}, format='json')

    def test_resposta_igual_para_email_existente_ou_nao(self):
        r1 = self.pedir('EQUIPE@exemplo.org')
        r2 = self.pedir('ninguem@exemplo.org')
        self.assertEqual((r1.status_code, r2.status_code), (200, 200))
        self.assertEqual(r1.data, r2.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['equipe@exemplo.org'])

    def test_nao_envia_para_inativo_ou_quem_nao_e_equipe(self):
        criar_staff(email='inativo@exemplo.org', is_active=False)
        from .factories import criar_usuario
        criar_usuario(email='comum@exemplo.org')
        self.pedir('inativo@exemplo.org')
        self.pedir('comum@exemplo.org')
        self.assertEqual(len(mail.outbox), 0)

    def test_redefine_pelo_link_uma_unica_vez(self):
        self.pedir('equipe@exemplo.org')
        uid, token = _link_redefinicao(mail.outbox[0].body)
        r = self.cliente.post('/api/auth/redefinir-senha/', {'uid': uid, 'token': token, 'senha': 'Nova-Senha-2026'}, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        self.staff.refresh_from_db()
        self.assertTrue(self.staff.check_password('Nova-Senha-2026'))
        r = self.cliente.post('/api/auth/redefinir-senha/', {'uid': uid, 'token': token, 'senha': 'Outra-Senha-2026'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_token_invalido(self):
        r = self.cliente.post('/api/auth/redefinir-senha/', {'uid': 'xx', 'token': 'abc-def', 'senha': 'Nova-Senha-2026'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_limite_de_tentativas(self):
        codigos = [self.pedir('ninguem@exemplo.org').status_code for _ in range(11)]
        self.assertEqual(codigos[-1], 429)
