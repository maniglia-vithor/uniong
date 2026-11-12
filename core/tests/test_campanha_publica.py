import shutil
import tempfile
from datetime import date, timedelta
from decimal import Decimal

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from core.models import Campanha, Notificacao
from core.tests.factories import criar_campanha, criar_despesa, criar_doacao, criar_membro, criar_staff
from core.tests.test_anexos import PNG, SVG


@override_settings(FRONTEND_URL='https://portal.exemplo.org')
class CampanhaPublicaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.dir = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.dir)
        self.override.enable()
        self.camp = criar_campanha(titulo='Natal <Solidário>', meta_valor=Decimal('1000'), descricao='Brinquedos para crianças')
        criar_doacao(campanha=self.camp, valor=Decimal('400'))
        criar_despesa(campanha=self.camp, valor=Decimal('150'), descricao='Interno', descricao_publica='Compra de brinquedos',
                      status='pago', data_vencimento=date(2026, 1, 5), data_pagamento=date(2026, 1, 6))

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_pagina_de_compartilhamento_tem_open_graph_e_redireciona(self):
        resp = self.client.get(f'/c/{self.camp.pk}/')
        html = resp.content.decode()
        self.assertEqual(resp.status_code, 200)
        self.assertIn('<meta property="og:title" content="Natal &lt;Solidário&gt;">', html)
        self.assertIn('Arrecadados R$ 400,00 de R$ 1.000,00', html)
        self.assertIn(f'https://portal.exemplo.org/transparencia/campanha/{self.camp.pk}', html)
        self.assertNotIn('<Solidário>', html)

    def test_endpoint_publico_com_prestacao_de_contas(self):
        dados = self.client.get(f'/api/public/campanhas/{self.camp.pk}/').data
        self.assertEqual((dados['valor_arrecadado'], dados['valor_gasto'], dados['saldo']), ('400.00', '150.00', '250.00'))
        self.assertEqual([d['descricao'] for d in dados['despesas']], ['Compra de brinquedos'])
        self.assertEqual(dados['url_compartilhamento'], f'/c/{self.camp.pk}/')

    def test_campanha_pausada_nao_aparece(self):
        pausada = criar_campanha(status='pausada')
        self.assertEqual(self.client.get(f'/api/public/campanhas/{pausada.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/c/{pausada.pk}/').status_code, 404)

    def test_campanha_vencida_nao_aparece_como_ativa(self):
        ontem = timezone.localdate() - timedelta(days=1)
        vencida = criar_campanha(titulo='Vencida', data_inicio=ontem - timedelta(days=30), data_fim=ontem)
        portal = self.client.get('/api/public/transparencia/').data
        self.assertNotIn('Vencida', [c['titulo'] for c in portal['campanhas']])
        self.assertEqual(self.client.get(f'/api/public/campanhas/{vencida.pk}/').data['status_efetivo'], 'encerrada')

    def test_doacao_em_campanha_vencida_recusada(self):
        ontem = timezone.localdate() - timedelta(days=1)
        vencida = criar_campanha(data_inicio=ontem - timedelta(days=30), data_fim=ontem)
        self.client.force_authenticate(criar_staff())
        resp = self.client.post('/api/doacoes/', {
            'apoiador': criar_membro().pk, 'campanha': vencida.pk, 'valor': '10', 'data': str(ontem), 'status': 'confirmada',
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_meta_atingida_notifica_uma_vez(self):
        criar_staff()
        self.client.force_authenticate(criar_staff())
        membro = criar_membro()
        for valor in ['600', '50']:
            self.client.post('/api/doacoes/', {
                'apoiador': membro.pk, 'campanha': self.camp.pk, 'valor': valor,
                'data': str(timezone.localdate()), 'status': 'confirmada',
            }, format='json')
        avisos = Notificacao.objects.filter(action_text__contains='atingiu a meta')
        self.assertEqual(avisos.values('usuario').distinct().count(), Notificacao.objects.values('usuario').distinct().count())
        self.assertEqual(avisos.count(), 2)  # um aviso para cada um dos 2 usuários staff, uma única vez
        self.assertIsNotNone(Campanha.objects.get(pk=self.camp.pk).meta_notificada_em)

    def test_imagem_valida_e_svg_recusado(self):
        self.client.force_authenticate(criar_staff())
        url = f'/api/campanhas/{self.camp.pk}/imagem/'
        resp = self.client.post(url, {'imagem': SimpleUploadedFile('x.svg', SVG, content_type='image/svg+xml')}, format='multipart')
        self.assertEqual(resp.status_code, 400)
        resp = self.client.post(url, {'imagem': SimpleUploadedFile('capa.png', PNG, content_type='image/png')}, format='multipart')
        self.assertEqual(resp.status_code, 200)
        self.client.force_authenticate(None)
        imagem = self.client.get(resp.data['imagem_url'])
        self.assertEqual((imagem.status_code, imagem['Content-Type'], imagem['X-Content-Type-Options']), (200, 'image/png', 'nosniff'))
        self.assertIn('og:image', self.client.get(f'/c/{self.camp.pk}/').content.decode())
