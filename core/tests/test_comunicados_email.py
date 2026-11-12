import re
from io import StringIO

from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Apoiador, Comunicado, ConfiguracaoInstituicao

from .factories import criar_membro, criar_staff


@override_settings(FRONTEND_URL='http://portal.exemplo.org', COMUNICADOS_LOTE=2, COMUNICADOS_LIMITE_SINCRONO=10)
class ComunicadosEmailTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())
        ConfiguracaoInstituicao.objects.update_or_create(pk=1, defaults={'nome': 'Instituto Esperança'})
        self.ativos = [criar_membro(status='ativo') for _ in range(3)]
        criar_membro(status='inativo')
        criar_membro(status='interessado')
        criar_membro(status='ativo', recebe_comunicados=False)

    def comunicado(self, publico='apoiadores'):
        return Comunicado.objects.create(titulo='Assembleia', conteudo='Dia 10, às 19h.', publico_alvo=publico)

    def test_envia_so_para_ativos_que_aceitam(self):
        c = self.comunicado()
        r = self.cliente.post(f'/api/comunicados/{c.id}/enviar-email/')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(mail.outbox), 3)
        self.assertEqual(sorted(m.to[0] for m in mail.outbox), sorted(a.email for a in self.ativos))
        self.assertEqual(r.data['emails_enviados'], 3)
        self.assertIsNotNone(r.data['enviado_em'])
        self.assertIn('[Instituto Esperança] Assembleia', mail.outbox[0].subject)
        self.assertIn('Dia 10, às 19h.', mail.outbox[0].body)

    def test_nao_reenvia_e_nao_envia_publico(self):
        c = self.comunicado()
        self.cliente.post(f'/api/comunicados/{c.id}/enviar-email/')
        self.assertEqual(self.cliente.post(f'/api/comunicados/{c.id}/enviar-email/').status_code, 400)
        self.assertEqual(len(mail.outbox), 3)
        publico = self.comunicado('publico')
        self.assertEqual(self.cliente.post(f'/api/comunicados/{publico.id}/enviar-email/').status_code, 400)

    def test_limite_do_envio_pela_tela_e_comando(self):
        for _ in range(8):
            criar_membro(status='ativo')
        c = self.comunicado()
        r = self.cliente.post(f'/api/comunicados/{c.id}/enviar-email/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('enviar_comunicado', r.data['erro'])
        self.assertEqual(len(mail.outbox), 0)
        saida = StringIO()
        call_command('enviar_comunicado', str(c.id), stdout=saida)
        self.assertEqual(len(mail.outbox), 11)
        c.refresh_from_db()
        self.assertEqual(c.emails_enviados, 11)

    def test_link_de_descadastro(self):
        c = self.comunicado()
        self.cliente.post(f'/api/comunicados/{c.id}/enviar-email/')
        mensagem = next(m for m in mail.outbox if m.to[0] == self.ativos[0].email)
        token = re.search(r'http://portal\.exemplo\.org/descadastrar/(\S+)', mensagem.body).group(1)
        self.assertIn(token, mensagem.extra_headers['List-Unsubscribe'])
        anonimo = APIClient()
        r = anonimo.get(f'/api/public/descadastrar/{token}/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['recebe_comunicados'])  # GET não altera
        r = anonimo.post(f'/api/public/descadastrar/{token}/')
        self.assertFalse(r.data['recebe_comunicados'])
        self.assertFalse(Apoiador.objects.get(pk=self.ativos[0].pk).recebe_comunicados)
        self.assertEqual(anonimo.post('/api/public/descadastrar/token-falso/').status_code, 400)

    def test_quantidade_de_destinatarios(self):
        r = self.cliente.get('/api/comunicados/destinatarios/')
        self.assertEqual(r.data, {'quantidade': 3, 'limite': 10})
