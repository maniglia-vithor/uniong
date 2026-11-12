import shutil
import tempfile
from datetime import date
from decimal import Decimal
from io import StringIO

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core import indicadores
from core.contribuicoes import gerar_doacoes_do_mes
from core.models import Contribuicao, Doacao

from .factories import criar_campanha, criar_doacao, criar_membro, criar_staff
from .test_indicadores import relogio

PDF = b'%PDF-1.4\n%teste\n'


class DoacaoAnonimaEBensTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())

    def test_doacao_anonima(self):
        r = self.cliente.post('/api/doacoes/', {
            'apoiador': None, 'valor': '50.00', 'data': '2026-01-10', 'status': 'confirmada', 'forma_pagamento': 'dinheiro',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertTrue(r.data['anonima'])
        self.assertEqual(r.data['apoiador_nome'], 'Anônimo')
        self.assertEqual(r.data['forma_pagamento_display'], 'Dinheiro')

    def test_relatorio_mostra_anonimo(self):
        criar_doacao(apoiador=None, valor=Decimal('30'))
        r = self.cliente.get('/api/relatorios/doacoes/')
        self.assertIn('Anônimo', r.content.decode('utf-8-sig'))

    def test_forma_de_pagamento_padrao_pix(self):
        r = self.cliente.post('/api/doacoes/', {
            'apoiador': criar_membro().id, 'valor': '20.00', 'data': '2026-01-10',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['forma_pagamento'], 'pix')

    def test_financeira_exige_valor(self):
        r = self.cliente.post('/api/doacoes/', {'apoiador': None, 'data': '2026-01-10'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('valor', r.data)

    def test_bens_exigem_descricao_e_gravam_valor_zero(self):
        r = self.cliente.post('/api/doacoes/', {'tipo': 'bens', 'data': '2026-01-10'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('descricao_bens', r.data)
        r = self.cliente.post('/api/doacoes/', {
            'tipo': 'bens', 'descricao_bens': '20 cestas básicas', 'valor_estimado': '1500.00',
            'valor': '999.00', 'data': '2026-01-10', 'status': 'confirmada',
        }, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Decimal(r.data['valor']), Decimal('0'))
        self.assertEqual(r.data['forma_pagamento'], '')

    def test_bens_fora_dos_totais_financeiros(self):
        campanha = criar_campanha(meta_valor=Decimal('1000'))
        criar_doacao(campanha=campanha, valor=Decimal('100'), data=date(2026, 1, 5))
        Doacao.objects.create(
            campanha=campanha, tipo='bens', valor=0, descricao_bens='Roupas', valor_estimado=Decimal('800'),
            data=date(2026, 1, 6), status='confirmada',
        )
        self.assertEqual(campanha.valor_arrecadado, Decimal('100'))
        self.assertEqual(indicadores.total_arrecadado(), Decimal('100'))
        self.assertEqual(indicadores.doacoes_confirmadas().count(), 1)
        with relogio(2026, 1, 20):
            self.assertEqual(indicadores.resumo_painel()['doacoes_mes']['value'], 100.0)
        resumo = self.cliente.get('/api/doacoes/resumo/').data
        self.assertEqual(resumo['total_confirmado'], 100.0)
        self.assertEqual(resumo['quantidade_confirmadas'], 1)
        self.assertEqual(resumo['bens_quantidade'], 1)
        self.assertEqual(resumo['bens_valor_estimado'], 800.0)
        csv = self.cliente.get('/api/relatorios/doacoes/', {'tipo': 'bens'}).content.decode('utf-8-sig')
        self.assertIn('Roupas', csv)
        self.assertIn('800,00', csv)


class ComprovanteDoacaoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.pasta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.pasta, ignore_errors=True)
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())

    def test_envia_baixa_e_remove(self):
        with override_settings(PRIVATE_MEDIA_ROOT=self.pasta):
            doacao = criar_doacao()
            url = f'/api/doacoes/{doacao.id}/comprovante/'
            r = self.cliente.post(url, {'comprovante': SimpleUploadedFile('pix.pdf', PDF)}, format='multipart')
            self.assertEqual(r.status_code, 200, r.data)
            self.assertTrue(r.data['tem_comprovante'])
            r = self.cliente.get(url)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(b''.join(r.streaming_content), PDF)
            self.assertEqual(self.cliente.delete(url).status_code, 204)
            self.assertEqual(self.cliente.get(url).status_code, 404)

    def test_recusa_arquivo_invalido(self):
        with override_settings(PRIVATE_MEDIA_ROOT=self.pasta):
            doacao = criar_doacao()
            r = self.cliente.post(f'/api/doacoes/{doacao.id}/comprovante/',
                                  {'comprovante': SimpleUploadedFile('x.pdf', b'nao e pdf')}, format='multipart')
            self.assertEqual(r.status_code, 400)


class ContribuicoesTests(TestCase):
    def setUp(self):
        self.membro = criar_membro()

    def contribuicao(self, **kw):
        dados = {'apoiador': self.membro, 'valor': Decimal('30'), 'periodicidade': 'mensal',
                 'dia_vencimento': 10, 'data_inicio': date(2026, 1, 1)}
        dados.update(kw)
        return Contribuicao.objects.create(**dados)

    def test_gera_pendente_e_e_idempotente(self):
        c = self.contribuicao()
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 3, 15)), (1, 0))
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 3, 2)), (0, 1))
        doacao = Doacao.objects.get(contribuicao=c)
        self.assertEqual(doacao.status, 'pendente')
        self.assertEqual(doacao.data, date(2026, 3, 10))
        self.assertEqual(doacao.origem, 'contribuicao')
        self.assertEqual(doacao.valor, Decimal('30'))

    def test_comando_idempotente(self):
        self.contribuicao()
        saida = StringIO()
        call_command('gerar_contribuicoes', '--mes', '2026-02', stdout=saida)
        call_command('gerar_contribuicoes', '--mes', '2026-02', stdout=saida)
        self.assertEqual(Doacao.objects.count(), 1)
        self.assertIn('1 já existia', saida.getvalue())

    def test_periodicidade_inicio_e_inativas(self):
        self.contribuicao(periodicidade='trimestral', data_inicio=date(2026, 2, 20))
        self.contribuicao(ativa=False)
        self.contribuicao(data_inicio=date(2026, 6, 1))
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 1, 1)), (0, 0))  # trimestral ainda não começou
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 2, 1)), (1, 0))
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 3, 1)), (0, 0))
        self.assertEqual(gerar_doacoes_do_mes(date(2026, 5, 1)), (1, 0))

    def test_api_valida_dia(self):
        cliente = APIClient()
        cliente.force_authenticate(criar_staff())
        r = cliente.post('/api/contribuicoes/', {
            'apoiador': self.membro.id, 'valor': '25.00', 'periodicidade': 'mensal',
            'dia_vencimento': 31, 'data_inicio': '2026-01-01', 'forma_pagamento': 'pix',
        }, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('dia_vencimento', r.data)
        r = cliente.get('/api/contribuicoes/', {'apoiador': self.membro.id})
        self.assertEqual(r.status_code, 200)
