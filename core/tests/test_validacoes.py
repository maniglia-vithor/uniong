from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Apoiador, Campanha
from core.normalizacao import normalizar_celular
from core.tests.factories import criar_campanha, criar_doacao, criar_membro, criar_staff


class ValidacoesTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())

    def test_campanha_meta_deve_ser_positiva(self):
        for meta in ['0', '-10']:
            resp = self.client.post('/api/campanhas/', {
                'titulo': 'X', 'meta_valor': meta, 'status': 'ativa', 'data_inicio': '2026-01-01',
            }, format='json')
            self.assertEqual(resp.status_code, 400)
            self.assertIn('meta_valor', resp.data)

    def test_campanha_fim_antes_do_inicio(self):
        resp = self.client.post('/api/campanhas/', {
            'titulo': 'X', 'meta_valor': '10', 'status': 'ativa',
            'data_inicio': '2026-03-01', 'data_fim': '2026-02-28',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('data_fim', resp.data)

    def test_campanha_patch_fim_antes_do_inicio_existente(self):
        camp = criar_campanha()
        resp = self.client.patch(f'/api/campanhas/{camp.pk}/', {'data_fim': '2025-12-31'}, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_doacao_valor_positivo(self):
        membro = criar_membro()
        resp = self.client.post('/api/doacoes/', {
            'apoiador': membro.pk, 'valor': '0', 'data': '2026-01-10', 'status': 'confirmada',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('valor', resp.data)

    def test_doacao_em_campanha_encerrada_recusada(self):
        membro = criar_membro()
        camp = criar_campanha(status='encerrada')
        resp = self.client.post('/api/doacoes/', {
            'apoiador': membro.pk, 'campanha': camp.pk, 'valor': '10', 'data': '2026-01-10', 'status': 'confirmada',
        }, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('campanha', resp.data)

    def test_doacao_existente_de_campanha_encerrada_pode_ser_editada(self):
        camp = criar_campanha()
        doacao = criar_doacao(campanha=camp, status='pendente')
        camp.status = 'encerrada'
        camp.save()
        resp = self.client.patch(f'/api/doacoes/{doacao.pk}/', {'status': 'confirmada'}, format='json')
        self.assertEqual(resp.status_code, 200)

    def test_despesa_valor_positivo(self):
        resp = self.client.post('/api/despesas/', {
            'descricao': 'Luz', 'valor': '0', 'data_vencimento': '2026-01-10', 'categoria': 'outros', 'status': 'pendente',
        }, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('valor', resp.data)

    def test_membro_email_normalizado_e_celular_com_mascara(self):
        resp = self.client.post('/api/apoiadores/', {
            'nome': 'Ana', 'email': '  Ana.Silva@Exemplo.ORG ', 'celular': '(11) 98765-4321',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['email'], 'ana.silva@exemplo.org')
        self.assertEqual(resp.data['celular'], '11987654321')

    def test_membro_email_duplicado_com_maiusculas(self):
        criar_membro(email='ana@exemplo.org')
        resp = self.client.post('/api/apoiadores/', {'nome': 'Outra', 'email': 'ANA@exemplo.org'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('email', resp.data)

    def test_membro_celular_invalido(self):
        resp = self.client.post('/api/apoiadores/', {'nome': 'Ana', 'email': 'a@x.org', 'celular': '1234'}, format='json')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('celular', resp.data)

    def test_normalizar_celular(self):
        self.assertEqual(normalizar_celular('+55 (11) 3333-4444'), '1133334444')
        self.assertIsNone(normalizar_celular(''))

    def test_excluir_campanha_com_doacoes_400(self):
        camp = criar_campanha()
        criar_doacao(campanha=camp)
        resp = self.client.delete(f'/api/campanhas/{camp.pk}/')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('Encerre a campanha', resp.data['erro'])
        self.assertTrue(Campanha.objects.filter(pk=camp.pk).exists())

    def test_excluir_campanha_sem_doacoes_204(self):
        camp = criar_campanha()
        self.assertEqual(self.client.delete(f'/api/campanhas/{camp.pk}/').status_code, 204)

    def test_excluir_membro_com_doacoes_400(self):
        membro = criar_membro()
        criar_doacao(apoiador=membro)
        resp = self.client.delete(f'/api/apoiadores/{membro.pk}/')
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Apoiador.objects.filter(pk=membro.pk).exists())
