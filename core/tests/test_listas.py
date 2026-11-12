from datetime import date, timedelta
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Doacao
from core.tests.factories import criar_campanha, criar_despesa, criar_membro, criar_staff


class PaginacaoEListasTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client.force_authenticate(criar_staff())
        self.ana = criar_membro(nome='Ana Souza', email='ana@exemplo.org')
        self.bruno = criar_membro(nome='Bruno Lima', email='bruno@exemplo.org')
        self.camp = criar_campanha(titulo='Agasalho')
        inicio = date(2026, 1, 1)
        doacoes = []
        for i in range(60):
            doacoes.append(Doacao(
                apoiador=self.ana if i % 2 else self.bruno,
                campanha=self.camp if i % 3 == 0 else None,
                valor=Decimal(i + 1),
                data=inicio + timedelta(days=i),
                status='confirmada' if i < 50 else 'pendente',
            ))
        Doacao.objects.bulk_create(doacoes)

    def test_page_size_50(self):
        resp = self.client.get('/api/doacoes/?page_size=50')
        self.assertEqual(resp.data['count'], 60)
        self.assertEqual(len(resp.data['results']), 50)

    def test_padrao_20_e_limite_500(self):
        self.assertEqual(len(self.client.get('/api/doacoes/').data['results']), 20)
        self.assertEqual(len(self.client.get('/api/doacoes/?page_size=9999').data['results']), 60)

    def test_busca_por_doador_e_campanha(self):
        self.assertEqual(self.client.get('/api/doacoes/?search=Ana').data['count'], 30)
        self.assertEqual(self.client.get('/api/doacoes/?search=Agasalho').data['count'], 20)

    def test_ordenacao(self):
        valores = [r['valor'] for r in self.client.get('/api/doacoes/?ordering=-valor&page_size=3').data['results']]
        self.assertEqual(valores, ['60.00', '59.00', '58.00'])
        nomes = [r['apoiador_nome'] for r in self.client.get('/api/doacoes/?ordering=apoiador__nome&page_size=1').data['results']]
        self.assertEqual(nomes, ['Ana Souza'])

    def test_filtro_periodo(self):
        resp = self.client.get('/api/doacoes/?data_inicio=2026-01-01&data_fim=2026-01-10')
        self.assertEqual(resp.data['count'], 10)
        self.assertEqual(self.client.get('/api/doacoes/?data_inicio=2026-13-01').status_code, 400)

    def test_total_confirmado_considera_todos_os_registros(self):
        resp = self.client.get('/api/doacoes/resumo/')
        self.assertEqual(resp.data['quantidade'], 60)
        self.assertEqual(resp.data['total_confirmado'], float(sum(range(1, 51))))
        filtrado = self.client.get('/api/doacoes/resumo/?search=Ana')
        self.assertEqual(filtrado.data['quantidade'], 30)

    def test_membros_busca_e_ordenacao_por_total(self):
        self.assertEqual(self.client.get('/api/apoiadores/?search=bruno@').data['count'], 1)
        primeiro = self.client.get('/api/apoiadores/?ordering=-total_doado').data['results'][0]
        self.assertEqual(primeiro['nome'], 'Ana Souza')
        self.assertGreater(primeiro['total_doado'], 0)

    def test_opcoes_sem_paginacao_e_so_ativos(self):
        criar_membro(nome='Inativo', email='inativo@exemplo.org', status='inativo')
        criar_campanha(titulo='Velha', status='encerrada')
        membros = self.client.get('/api/apoiadores/opcoes/').data
        self.assertEqual([m['nome'] for m in membros], ['Ana Souza', 'Bruno Lima'])
        self.assertEqual(set(membros[0].keys()), {'id', 'nome'})
        campanhas = self.client.get('/api/campanhas/opcoes/').data
        self.assertEqual([c['titulo'] for c in campanhas], ['Agasalho'])

    def test_campanhas_ordenacao_por_arrecadado(self):
        criar_campanha(titulo='Zerada')
        titulos = [c['titulo'] for c in self.client.get('/api/campanhas/?ordering=-arrecadado').data['results']]
        self.assertEqual(titulos[0], 'Agasalho')

    def test_despesas_busca_e_periodo(self):
        criar_despesa(descricao='Aluguel', data_vencimento=date(2026, 2, 5))
        criar_despesa(descricao='Internet', data_vencimento=date(2026, 3, 5))
        self.assertEqual(self.client.get('/api/despesas/?search=alug').data['count'], 1)
        self.assertEqual(self.client.get('/api/despesas/?data_inicio=2026-03-01').data['count'], 1)
