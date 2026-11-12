import shutil
import tempfile
from datetime import date

from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import override_settings
from rest_framework.test import APITestCase

from core.models import DespesaAnexo
from core.tests.factories import criar_despesa, criar_staff
from core.tests.test_anexos import PDF
from core.tests.test_indicadores import relogio


class ComprovantesPublicosTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.dir = tempfile.mkdtemp()
        self.override = override_settings(PRIVATE_MEDIA_ROOT=self.dir)
        self.override.enable()
        self.despesa = criar_despesa(status='pago', data_vencimento=date(2026, 5, 1), data_pagamento=date(2026, 5, 2),
                                     categoria='projetos')
        self.anexo = DespesaAnexo(despesa=self.despesa, nome_original='nota.pdf')
        self.anexo.arquivo.save('nota.pdf', ContentFile(PDF), save=True)
        self.url = f'/api/public/despesas/{self.despesa.id}/comprovantes/{self.anexo.id}/'

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_anexo_nao_publico_404(self):
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_anexo_publico_com_cabecalhos_de_seguranca(self):
        self.anexo.publico = True
        self.anexo.save()
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp['X-Content-Type-Options'], 'nosniff')
        self.assertIn('attachment', resp['Content-Disposition'])
        self.assertEqual(b''.join(resp.streaming_content), PDF)

    def test_rh_nunca_publica_comprovante(self):
        self.despesa.categoria = 'recursos_humanos'
        self.despesa.save()
        DespesaAnexo.objects.filter(pk=self.anexo.pk).update(publico=True)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_marcar_publico_pelo_painel_e_aparecer_no_portal(self):
        self.client.force_authenticate(criar_staff())
        resp = self.client.patch(f'/api/despesas/{self.despesa.id}/anexos/{self.anexo.id}/', {'publico': True}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data['publico'])
        self.client.force_authenticate(None)
        with relogio(2026, 5, 10):
            linhas = self.client.get('/api/public/transparencia/').data['gastos_mes_lista']
        self.assertEqual(linhas[0]['comprovantes'], [self.url])

    def test_patch_exige_booleano(self):
        self.client.force_authenticate(criar_staff())
        resp = self.client.patch(f'/api/despesas/{self.despesa.id}/anexos/{self.anexo.id}/', {'publico': 'sim'}, format='json')
        self.assertEqual(resp.status_code, 400)
