from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core.extenso import reais_por_extenso
from core.models import ConfiguracaoInstituicao, Doacao, Recibo

from .factories import criar_doacao, criar_membro, criar_staff


class ExtensoTests(TestCase):
    def test_valores(self):
        casos = {
            '0.01': 'um centavo',
            '1': 'um real',
            '1.01': 'um real e um centavo',
            '21.30': 'vinte e um reais e trinta centavos',
            '100': 'cem reais',
            '101': 'cento e um reais',
            '1000': 'mil reais',
            '1050': 'mil e cinquenta reais',
            '1234.56': 'mil duzentos e trinta e quatro reais e cinquenta e seis centavos',
            '2300': 'dois mil e trezentos reais',
            '1000000': 'um milhão de reais',
            '2500000.10': 'dois milhões e quinhentos mil reais e dez centavos',
        }
        for valor, esperado in casos.items():
            with self.subTest(valor=valor):
                self.assertEqual(reais_por_extenso(Decimal(valor)), esperado)


class DocumentoMembroTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())

    def test_cpf_valido_e_invalido(self):
        base = {'nome': 'Ana', 'email': 'ana@exemplo.org', 'status': 'ativo'}
        r = self.cliente.post('/api/apoiadores/', {**base, 'documento': '529.982.247-24'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('documento', r.data)
        r = self.cliente.post('/api/apoiadores/', {**base, 'documento': '529.982.247-25'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data['documento'], '52998224725')
        self.assertEqual(r.data['documento_formatado'], '529.982.247-25')

    def test_cnpj_aceito_e_vazio_permitido(self):
        r = self.cliente.post('/api/apoiadores/', {'nome': 'Empresa', 'email': 'e@exemplo.org', 'documento': '11.222.333/0001-81'}, format='json')
        self.assertEqual(r.status_code, 201, r.data)
        r = self.cliente.post('/api/apoiadores/', {'nome': 'Sem doc', 'email': 's@exemplo.org', 'documento': ''}, format='json')
        self.assertEqual(r.status_code, 201, r.data)


class ReciboTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())
        ConfiguracaoInstituicao.objects.update_or_create(pk=1, defaults={'nome': 'Instituto Esperança', 'cnpj': '11222333000181'})

    def emitir(self, doacao):
        return self.cliente.post(f'/api/doacoes/{doacao.id}/recibo/')

    def test_dados_do_recibo(self):
        membro = criar_membro(nome='Ana Souza', documento='52998224725')
        doacao = criar_doacao(apoiador=membro, valor=Decimal('150.50'), forma_pagamento='transferencia')
        r = self.emitir(doacao)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data['doador'], {'nome': 'Ana Souza', 'documento': '529.982.247-25', 'email': membro.email})
        self.assertEqual(r.data['doacao']['valor_extenso'], 'cento e cinquenta reais e cinquenta centavos')
        self.assertEqual(r.data['doacao']['forma_pagamento'], 'Transferência bancária')
        self.assertEqual(r.data['instituicao']['cnpj_formatado'], '11.222.333/0001-81')

    def test_numeracao_sequencial_sem_repetir(self):
        doacoes = [criar_doacao() for _ in range(3)]
        numeros = [self.emitir(d).data['numero'] for d in doacoes]
        self.assertEqual(numeros, sorted(numeros))
        self.assertEqual(len(set(numeros)), 3)
        self.assertEqual(numeros[1], numeros[0] + 1)
        # reemitir devolve o mesmo número, sem criar outro
        self.assertEqual(self.emitir(doacoes[0]).data['numero'], numeros[0])
        self.assertEqual(Recibo.objects.count(), 3)

    def test_so_doacao_confirmada(self):
        self.assertEqual(self.emitir(criar_doacao(status='pendente')).status_code, 400)
        self.assertEqual(Recibo.objects.count(), 0)

    def test_doacao_com_recibo_nao_pode_ser_excluida(self):
        doacao = criar_doacao()
        self.emitir(doacao)
        r = self.cliente.delete(f'/api/doacoes/{doacao.id}/')
        self.assertEqual(r.status_code, 400)
        self.assertTrue(Doacao.objects.filter(pk=doacao.pk).exists())

    def test_envio_por_email(self):
        membro = criar_membro(email='ana@exemplo.org')
        doacao = criar_doacao(apoiador=membro, valor=Decimal('80'))
        r = self.cliente.post(f'/api/doacoes/{doacao.id}/recibo/enviar/')
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['ana@exemplo.org'])
        self.assertIn('oitenta reais', mail.outbox[0].body)
        self.assertIn('Instituto Esperança', mail.outbox[0].subject)
        self.assertEqual(r.data['enviado_para'], 'ana@exemplo.org')

    def test_anonima_nao_envia_email(self):
        doacao = criar_doacao(apoiador=None)
        r = self.cliente.post(f'/api/doacoes/{doacao.id}/recibo/enviar/')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)
