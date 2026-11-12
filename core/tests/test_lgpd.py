import json
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core import indicadores
from core.models import Apoiador, Contribuicao, LogAlteracao, Notificacao

from .factories import criar_campanha, criar_doacao, criar_staff


class LgpdTests(TestCase):
    def setUp(self):
        cache.clear()
        self.superusuario = criar_staff(is_superuser=True)
        self.admin = APIClient()
        self.admin.force_authenticate(self.superusuario)
        # Cadastro pela API para gerar trilha de auditoria e notificação com os dados pessoais.
        r = self.admin.post('/api/apoiadores/', {
            'nome': 'Maria Joaquina', 'email': 'maria@exemplo.org', 'celular': '11987654321', 'documento': '52998224725',
        }, format='json')
        self.membro = Apoiador.objects.get(pk=r.data['id'])
        self.admin.patch(f'/api/apoiadores/{self.membro.id}/', {'celular': '11912345678'}, format='json')
        self.campanha = criar_campanha()
        criar_doacao(apoiador=self.membro, campanha=self.campanha, valor=Decimal('120'))
        criar_doacao(apoiador=self.membro, valor=Decimal('30'))
        Contribuicao.objects.create(apoiador=self.membro, valor=Decimal('20'), data_inicio='2026-01-01')

    def anonimizar(self, cliente=None, **dados):
        return (cliente or self.admin).post(f'/api/apoiadores/{self.membro.id}/anonimizar/', dados or {'confirmar': True}, format='json')

    def test_nenhum_dado_pessoal_original_permanece(self):
        totais_antes = (indicadores.total_arrecadado(), self.campanha.valor_arrecadado)
        r = self.anonimizar()
        self.assertEqual(r.status_code, 200, r.data)
        m = Apoiador.objects.get(pk=self.membro.pk)
        originais = ['Maria', 'Joaquina', 'maria@exemplo.org', '11987654321', '11912345678', '52998224725']
        registro = ' '.join(str(getattr(m, f.attname)) for f in Apoiador._meta.concrete_fields)
        for dado in originais:
            self.assertNotIn(dado, registro)
        logs = ' '.join(f'{l.antes} {l.depois}' for l in LogAlteracao.objects.filter(modelo='Apoiador', objeto_id=m.pk))
        notificacoes = ' '.join(f'{n.mensagem} {n.action_text}' for n in Notificacao.objects.all())
        for dado in originais:
            self.assertNotIn(dado, logs)
            self.assertNotIn(dado, notificacoes)
        self.assertEqual(m.status, 'inativo')
        self.assertFalse(m.recebe_comunicados)
        self.assertIsNotNone(m.anonimizado_em)
        self.assertFalse(m.contribuicoes.filter(ativa=True).exists())
        # doações mantidas: totais financeiros iguais
        self.assertEqual(m.doacoes.count(), 2)
        self.campanha.refresh_from_db()
        self.assertEqual((indicadores.total_arrecadado(), self.campanha.valor_arrecadado), totais_antes)
        self.assertTrue(LogAlteracao.objects.filter(objeto_id=m.pk, campo='dados pessoais').exists())

    def test_exige_superusuario_e_confirmacao(self):
        operador = APIClient()
        operador.force_authenticate(criar_staff())
        self.assertEqual(self.anonimizar(operador).status_code, 403)
        self.assertEqual(self.anonimizar(confirmar='sim').status_code, 400)
        self.assertEqual(Apoiador.objects.get(pk=self.membro.pk).nome, 'Maria Joaquina')
        self.anonimizar()
        self.assertEqual(self.anonimizar().status_code, 400)  # já anonimizado

    def test_exportar_dados(self):
        r = self.admin.get(f'/api/apoiadores/{self.membro.id}/exportar/')
        self.assertEqual(r.status_code, 200)
        self.assertIn('attachment', r['Content-Disposition'])
        dados = json.loads(r.content)
        self.assertEqual(dados['titular']['email'], 'maria@exemplo.org')
        self.assertEqual(dados['titular']['documento'], '529.982.247-25')
        self.assertEqual(len(dados['doacoes']), 2)
        self.assertEqual(len(dados['contribuicoes_periodicas']), 1)
