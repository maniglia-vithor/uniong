import os
import shutil
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from core.models import DespesaAnexo
from core.tests.factories import criar_despesa, criar_staff, criar_usuario

PDF = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32
SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'


class AnexosTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.dir = tempfile.mkdtemp()
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.dir)
        self.override.enable()
        self.staff = criar_staff()
        self.despesa = criar_despesa()
        self.url = f'/api/despesas/{self.despesa.id}/'

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.dir, ignore_errors=True)

    def _enviar(self, nome, conteudo, tipo='application/octet-stream'):
        self.client.force_authenticate(self.staff)
        dados = {
            'descricao': self.despesa.descricao, 'valor': '200.00', 'data_vencimento': '2026-01-10',
            'categoria': 'outros', 'status': 'pendente', 'is_fixed': 'false',
            'anexos': [SimpleUploadedFile(nome, conteudo, content_type=tipo)],
        }
        return self.client.put(self.url, dados, format='multipart')

    def test_svg_e_rejeitado(self):
        resp = self._enviar('logo.svg', SVG, 'image/svg+xml')
        self.assertEqual(resp.status_code, 400)
        self.assertIn('anexos', resp.data)
        self.assertFalse(DespesaAnexo.objects.exists())

    def test_html_disfarcado_de_pdf_e_rejeitado(self):
        resp = self._enviar('nota.pdf', b'<html><script>alert(1)</script></html>', 'application/pdf')
        self.assertEqual(resp.status_code, 400)

    def test_arquivo_maior_que_5mb_e_rejeitado(self):
        resp = self._enviar('grande.pdf', PDF + b'0' * (5 * 1024 * 1024))
        self.assertEqual(resp.status_code, 400)

    def test_pdf_valido_e_salvo_com_nome_uuid_fora_do_media(self):
        resp = self._enviar('Nota Fiscal.pdf', PDF, 'application/pdf')
        self.assertEqual(resp.status_code, 200)
        anexo = DespesaAnexo.objects.get()
        self.assertEqual(anexo.nome_original, 'Nota Fiscal.pdf')
        nome_salvo = os.path.basename(anexo.arquivo.name)
        self.assertRegex(nome_salvo, r'^[0-9a-f]{32}\.pdf$')
        self.assertTrue(os.path.exists(os.path.join(self.dir, anexo.arquivo.name)))
        self.assertEqual(resp.data['anexos'][0]['url'], f'/api/despesas/{self.despesa.id}/anexos/{anexo.id}/download/')

    def test_png_valido_e_aceito(self):
        self.assertEqual(self._enviar('foto.png', PNG, 'image/png').status_code, 200)

    def test_download(self):
        self._enviar('Nota Fiscal.pdf', PDF, 'application/pdf')
        anexo = DespesaAnexo.objects.get()
        url = f'/api/despesas/{self.despesa.id}/anexos/{anexo.id}/download/'

        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(url).status_code, 401)

        self.client.force_authenticate(criar_usuario())
        self.assertEqual(self.client.get(url).status_code, 403)

        self.client.force_authenticate(self.staff)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(b''.join(resp.streaming_content), PDF)
        self.assertEqual(resp['Content-Type'], 'application/pdf')
        self.assertEqual(resp['X-Content-Type-Options'], 'nosniff')
        self.assertIn('attachment', resp['Content-Disposition'])
        self.assertIn('Nota Fiscal.pdf', resp['Content-Disposition'])

    def test_media_publica_nao_serve_anexos(self):
        self.assertEqual(self.client.get('/media/despesas/anexos/qualquer.pdf').status_code, 404)
