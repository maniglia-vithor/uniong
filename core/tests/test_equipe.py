import re
from datetime import datetime, timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
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
