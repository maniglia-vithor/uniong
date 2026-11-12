from django.core.cache import cache
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

from core.models import ConfiguracaoPix, LogAlteracao, Notificacao
from core.pix import mascarar, normalizar_chave_pix
from core.tests.factories import criar_staff

URL = '/api/configuracoes/pix/'
CPF_VALIDO = '529.982.247-25'
CNPJ_VALIDO = '11.222.333/0001-81'


class NormalizarChavePixTests(SimpleTestCase):
    def test_tipos_validos_e_normalizacao(self):
        casos = {
            CPF_VALIDO: ('52998224725', 'cpf'),
            CNPJ_VALIDO: ('11222333000181', 'cnpj'),
            ' Contato@ONG.org ': ('contato@ong.org', 'email'),
            '+55 (11) 99999-8888': ('+5511999998888', 'telefone'),
            '123E4567-E89B-12D3-A456-426614174000': ('123e4567-e89b-12d3-a456-426614174000', 'aleatoria'),
            '': ('', ''),
        }
        for entrada, esperado in casos.items():
            with self.subTest(entrada=entrada):
                self.assertEqual(normalizar_chave_pix(entrada), esperado)

    def test_chaves_invalidas(self):
        for entrada in ['529.982.247-24', '111.111.111-11', '11.222.333/0001-80', 'nao-e-chave',
                        '+1 555 123 4567', '+55 11 999', 'contato@', '12345']:
            with self.subTest(entrada=entrada):
                with self.assertRaises(ValueError):
                    normalizar_chave_pix(entrada)

    def test_mascarar(self):
        self.assertEqual(mascarar('52998224725'), '529******25')
        self.assertEqual(mascarar(''), '(vazio)')
        self.assertEqual(mascarar('abc'), '***')


class ConfiguracaoPixApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.super = criar_staff(is_superuser=True, username='chefe')
        self.staff = criar_staff(username='equipe')
        self.dados = {'chave': CPF_VALIDO, 'nome_recebedor': 'Associação UniONG', 'cidade': 'São Paulo'}

    def test_staff_comum_pode_ler_mas_nao_alterar(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(URL).status_code, 200)
        resp = self.client.put(URL, self.dados, format='json')
        self.assertEqual(resp.status_code, 403)
        self.assertEqual(ConfiguracaoPix.obter().chave, '')
        self.assertFalse(LogAlteracao.objects.exists())

    def test_superuser_altera_gera_log_e_notificacao(self):
        self.client.force_authenticate(self.super)
        resp = self.client.put(URL, self.dados, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['chave'], '52998224725')

        logs = LogAlteracao.objects.filter(modelo='ConfiguracaoPix')
        self.assertEqual(set(logs.values_list('campo', flat=True)), {'chave', 'nome_recebedor', 'cidade'})
        log_chave = logs.get(campo='chave')
        self.assertEqual((log_chave.antes, log_chave.depois, log_chave.usuario), ('', '52998224725', self.super))

        notifs = Notificacao.objects.filter(tipo='config')
        self.assertEqual(set(notifs.values_list('usuario__username', flat=True)), {'chefe', 'equipe'})
        texto = notifs.first().action_text
        self.assertIn('529******25', texto)
        self.assertNotIn('52998224725', texto)

    def test_sem_mudanca_nao_gera_log(self):
        self.client.force_authenticate(self.super)
        self.client.put(URL, self.dados, format='json')
        LogAlteracao.objects.all().delete()
        Notificacao.objects.all().delete()
        self.client.put(URL, self.dados, format='json')
        self.assertFalse(LogAlteracao.objects.exists())
        self.assertFalse(Notificacao.objects.exists())

    def test_chave_invalida_400(self):
        self.client.force_authenticate(self.super)
        resp = self.client.put(URL, {**self.dados, 'chave': '123.456.789-00'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('chave', resp.data)

    def test_limites_de_tamanho(self):
        self.client.force_authenticate(self.super)
        resp = self.client.put(URL, {**self.dados, 'nome_recebedor': 'N' * 26, 'cidade': 'C' * 16}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('nome_recebedor', resp.data)
        self.assertIn('cidade', resp.data)
