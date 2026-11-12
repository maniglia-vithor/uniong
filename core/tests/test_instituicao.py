import shutil
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.documentos import cnpj_valido, cpf_valido, formatar_documento, normalizar_documento
from core.models import ConfiguracaoInstituicao

from .factories import criar_campanha, criar_staff

PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32
CNPJ_VALIDO = '11.222.333/0001-81'


class DocumentosTests(TestCase):
    def test_cpf(self):
        self.assertTrue(cpf_valido('529.982.247-25'))
        self.assertFalse(cpf_valido('529.982.247-24'))
        self.assertFalse(cpf_valido('111.111.111-11'))
        self.assertFalse(cpf_valido('123'))

    def test_cnpj(self):
        self.assertTrue(cnpj_valido(CNPJ_VALIDO))
        self.assertFalse(cnpj_valido('11.222.333/0001-82'))
        self.assertFalse(cnpj_valido('00000000000000'))

    def test_normalizar_e_formatar(self):
        self.assertEqual(normalizar_documento('529.982.247-25'), '52998224725')
        self.assertEqual(normalizar_documento(''), '')
        self.assertEqual(formatar_documento('11222333000181'), CNPJ_VALIDO)
        with self.assertRaises(ValueError):
            normalizar_documento('52998224725', aceitar=('cnpj',))
        with self.assertRaises(ValueError):
            normalizar_documento('1234')


class InstituicaoTests(TestCase):
    def setUp(self):
        cache.clear()
        self.admin = APIClient()
        self.admin.force_authenticate(criar_staff(is_superuser=True))

    def test_superusuario_edita_e_portal_le(self):
        r = self.admin.patch('/api/configuracoes/instituicao/', {
            'nome': 'Instituto Esperança', 'cnpj': CNPJ_VALIDO, 'email': 'Contato@Esperanca.org',
            'telefone': '(11) 98765-4321', 'site': 'https://esperanca.org',
        }, format='json')
        self.assertEqual(r.status_code, 200, r.data)
        config = ConfiguracaoInstituicao.obter()
        self.assertEqual(config.cnpj, '11222333000181')
        self.assertEqual(config.email, 'contato@esperanca.org')
        publico = APIClient().get('/api/public/instituicao/').data
        self.assertEqual(publico['nome'], 'Instituto Esperança')
        self.assertEqual(publico['cnpj_formatado'], CNPJ_VALIDO)
        self.assertNotIn('portal_ativo', publico)

    def test_cnpj_invalido(self):
        r = self.admin.patch('/api/configuracoes/instituicao/', {'cnpj': '11.222.333/0001-82'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_operador_nao_edita(self):
        cliente = APIClient()
        cliente.force_authenticate(criar_staff())
        self.assertEqual(cliente.patch('/api/configuracoes/instituicao/', {'nome': 'X'}, format='json').status_code, 403)
        self.assertEqual(cliente.post('/api/configuracoes/instituicao/logo/', {}).status_code, 403)

    def test_logo_validado_e_servido(self):
        pasta = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, pasta, ignore_errors=True)
        with override_settings(MEDIA_ROOT=pasta):
            r = self.admin.post('/api/configuracoes/instituicao/logo/', {'logo': SimpleUploadedFile('l.pdf', b'%PDF-1.4')}, format='multipart')
            self.assertEqual(r.status_code, 400)
            r = self.admin.post('/api/configuracoes/instituicao/logo/', {'logo': SimpleUploadedFile('l.png', PNG)}, format='multipart')
            self.assertEqual(r.status_code, 200, r.data)
            url = APIClient().get('/api/public/instituicao/').data['logo_url']
            self.assertTrue(url.startswith('/api/public/instituicao/logo/'))
            r = APIClient().get(url)
            self.assertEqual(r.status_code, 200)
            self.assertEqual(r['Content-Type'], 'image/png')

    def test_nome_na_previa_e_prestacao(self):
        ConfiguracaoInstituicao.objects.update_or_create(pk=1, defaults={'nome': 'Instituto Esperança'})
        campanha = criar_campanha()
        html = APIClient().get(f'/c/{campanha.id}/').content.decode()
        self.assertIn('og:site_name" content="Instituto Esperança"', html)
        r = self.admin.get('/api/relatorios/prestacao-contas/')
        self.assertEqual(r.data['instituicao']['nome'], 'Instituto Esperança')
