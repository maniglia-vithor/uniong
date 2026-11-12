from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import LogAlteracao
from core.tests.factories import criar_campanha, criar_doacao, criar_membro, criar_staff


class AuditoriaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.super = criar_staff(is_superuser=True, first_name='Chefe')
        self.client.force_authenticate(self.super)

    def test_editar_valor_de_doacao_gera_log_com_antes_e_depois(self):
        doacao = criar_doacao(valor=Decimal('100.00'))
        resp = self.client.patch(f'/api/doacoes/{doacao.id}/', {'valor': '150.00'}, format='json')
        self.assertEqual(resp.status_code, 200)
        log = LogAlteracao.objects.get(modelo='Doacao', objeto_id=doacao.id, campo='valor')
        self.assertEqual((log.acao, log.antes, log.depois, log.usuario), ('edicao', '100.00', '150.00', self.super))
        self.assertFalse(LogAlteracao.objects.filter(modelo='Doacao', campo='status').exists())

    def test_excluir_gera_log(self):
        doacao = criar_doacao(valor=Decimal('42.00'))
        self.client.delete(f'/api/doacoes/{doacao.id}/')
        log = LogAlteracao.objects.get(modelo='Doacao', objeto_id=doacao.id, acao='exclusao')
        self.assertIn('valor=42.00', log.antes)

    def test_criar_gera_log(self):
        resp = self.client.post('/api/apoiadores/', {'nome': 'Ana', 'email': 'ana@exemplo.org'}, format='json')
        log = LogAlteracao.objects.get(modelo='Apoiador', objeto_id=resp.data['id'])
        self.assertEqual(log.acao, 'criacao')
        self.assertIn('nome=Ana', log.depois)

    def test_exclusao_bloqueada_nao_gera_log(self):
        camp = criar_campanha()
        criar_doacao(campanha=camp)
        self.client.delete(f'/api/campanhas/{camp.id}/')
        self.assertFalse(LogAlteracao.objects.filter(modelo='Campanha', acao='exclusao').exists())

    def test_acao_em_lote_gera_log(self):
        doacao = criar_doacao(status='pendente')
        self.client.post('/api/doacoes/acao-em-lote/', {'ids': [doacao.id], 'acao': 'confirmar'}, format='json')
        log = LogAlteracao.objects.get(modelo='Doacao', objeto_id=doacao.id, campo='status')
        self.assertEqual((log.antes, log.depois), ('pendente', 'confirmada'))

    def test_historico_filtrado_e_so_para_superusuario(self):
        membro = criar_membro()
        self.client.patch(f'/api/apoiadores/{membro.id}/', {'nome': 'Novo Nome'}, format='json')
        resp = self.client.get(f'/api/historico/?modelo=Apoiador&objeto_id={membro.id}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['results'][0]['campo'], 'nome')
        self.assertEqual(resp.data['results'][0]['usuario_nome'], 'Chefe')
        self.client.force_authenticate(criar_staff())
        self.assertEqual(self.client.get('/api/historico/').status_code, 403)
