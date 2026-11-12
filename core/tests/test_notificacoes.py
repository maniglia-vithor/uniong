from django.core.cache import cache
from rest_framework.test import APITestCase

from core.models import Notificacao
from core.tests.factories import criar_staff, criar_usuario


class NotificacoesTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = criar_staff()
        self.outro_staff = criar_staff()
        self.inativo = criar_staff(is_active=False)
        self.comum = criar_usuario()
        self.client.force_authenticate(self.staff)

    def test_despesa_gera_notificacao_com_alvo_mapeado(self):
        resp = self.client.post('/api/despesas/', {
            'descricao': 'Internet', 'valor': '120', 'data_vencimento': '2026-01-10', 'categoria': 'outros', 'status': 'pendente',
        }, format='multipart')
        notif = Notificacao.objects.filter(tipo='despesa').first()
        self.assertEqual((notif.target_type, notif.target_id), ('despesa', resp.data['id']))

    def test_so_staff_ativo_recebe(self):
        self.client.post('/api/apoiadores/', {'nome': 'Ana', 'email': 'ana@exemplo.org'}, format='json')
        destinatarios = set(Notificacao.objects.values_list('usuario_id', flat=True))
        self.assertEqual(destinatarios, {self.staff.id, self.outro_staff.id})

    def test_tipos_disponiveis(self):
        tipos = dict(Notificacao.TIPO_CHOICES)
        self.assertIn('despesa', tipos)
        self.assertIn('configuracao', tipos)
