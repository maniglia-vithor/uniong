from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Apoiador, Doacao, Notificacao
from core.tests.factories import criar_campanha, criar_membro, criar_staff

URL = '/api/public/doacoes/'


class DoacaoPublicaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = criar_staff()
        self.campanha = criar_campanha()
        self.dados = {
            'nome': 'Joana Prado', 'email': 'Joana@Exemplo.org', 'celular': '(11) 98888-7777',
            'campaign_id': self.campanha.id, 'valor': '50.00', 'consentimento': True,
        }

    def test_cria_membro_interessado_e_doacao_pendente_do_portal(self):
        resp = self.client.post(URL, self.dados, format='json')
        self.assertEqual(resp.status_code, 201)
        doacao = Doacao.objects.get(pk=resp.data['id'])
        self.assertEqual((doacao.status, doacao.origem), ('pendente', 'portal'))
        self.assertIsNotNone(doacao.consentimento_em)
        self.assertEqual(doacao.apoiador.status, 'interessado')
        self.assertEqual(doacao.apoiador.email, 'joana@exemplo.org')
        self.assertEqual(resp.data['txid'], f'DOA{doacao.id}')
        self.assertEqual(resp.data['valor'], '50.00')

    def test_email_existente_nao_altera_dados_do_membro(self):
        membro = criar_membro(nome='Joana Original', email='joana@exemplo.org', celular='1133334444', status='inativo')
        resp = self.client.post(URL, {**self.dados, 'nome': 'Outro Nome', 'celular': '11999999999'}, format='json')
        self.assertEqual(resp.status_code, 201)
        membro.refresh_from_db()
        self.assertEqual((membro.nome, membro.celular, membro.status), ('Joana Original', '1133334444', 'inativo'))
        self.assertEqual(Doacao.objects.get(pk=resp.data['id']).apoiador, membro)
        self.assertEqual(Apoiador.objects.count(), 1)

    def test_campanha_encerrada_400(self):
        encerrada = criar_campanha(status='encerrada')
        resp = self.client.post(URL, {**self.dados, 'campaign_id': encerrada.id}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('campaign_id', resp.data)
        self.assertFalse(Doacao.objects.exists())

    def test_limites_de_valor(self):
        for valor in ['0.99', '100000.01']:
            with self.subTest(valor=valor):
                resp = self.client.post(URL, {**self.dados, 'valor': valor}, format='json')
                self.assertEqual(resp.status_code, 400)
                self.assertIn('valor', resp.data)

    def test_exige_consentimento(self):
        resp = self.client.post(URL, {**self.dados, 'consentimento': False}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('consentimento', resp.data)

    def test_honeypot_responde_201_sem_gravar(self):
        resp = self.client.post(URL, {**self.dados, 'site': 'http://spam.example'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data['id'])
        self.assertFalse(Doacao.objects.exists())
        self.assertFalse(Apoiador.objects.exists())

    def test_notifica_a_equipe(self):
        self.client.post(URL, self.dados, format='json')
        notif = Notificacao.objects.get(usuario=self.staff)
        self.assertEqual(notif.tipo, 'doacao')
        self.assertIn('Nova intenção de doação de Joana Prado — R$ 50,00', notif.mensagem)

    def test_membro_interessado_vira_ativo_ao_confirmar(self):
        resp = self.client.post(URL, self.dados, format='json')
        doacao = Doacao.objects.get(pk=resp.data['id'])
        self.client.force_authenticate(self.staff)
        resp = self.client.patch(f'/api/doacoes/{doacao.id}/', {'status': 'confirmada'}, format='json')
        self.assertEqual(resp.status_code, 200)
        doacao.apoiador.refresh_from_db()
        self.assertEqual(doacao.apoiador.status, 'ativo')

    def test_interessado_nao_conta_como_ativo(self):
        self.client.post(URL, self.dados, format='json')
        kpis = self.client.get('/api/public/transparencia/').data['kpis']
        self.assertEqual(kpis['apoiadores_ativos'], 0)
        self.assertEqual(Decimal(Doacao.objects.get().valor), Decimal('50.00'))
