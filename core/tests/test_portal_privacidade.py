import json
from datetime import date
from decimal import Decimal

from django.core.cache import cache
from rest_framework.test import APITestCase

from core.tests.factories import criar_despesa, criar_doacao, criar_membro
from core.tests.test_indicadores import relogio


class PortalPrivacidadeTests(APITestCase):
    def setUp(self):
        cache.clear()
        pagamento = {'status': 'pago', 'data_vencimento': date(2026, 5, 1), 'data_pagamento': date(2026, 5, 2)}
        criar_despesa(descricao='Conta de luz do galpão (cliente 123-45)', categoria='administrativo', valor=Decimal('80'), **pagamento)
        criar_despesa(descricao='Compra interna sigilosa', descricao_publica='Cestas básicas da campanha',
                      categoria='projetos', valor=Decimal('300'), **pagamento)
        criar_despesa(descricao='Salário Fulano', categoria='recursos_humanos', valor=Decimal('1500'), **pagamento)
        criar_despesa(descricao='Salário Beltrana', categoria='recursos_humanos', valor=Decimal('1700'), **pagamento)
        criar_doacao(apoiador=criar_membro(nome='Doador Secreto da Silva'), data=date(2026, 5, 3))

    def _portal(self):
        with relogio(2026, 5, 10):
            return self.client.get('/api/public/transparencia/')

    def test_descricao_interna_nunca_aparece(self):
        texto = json.dumps(self._portal().data, ensure_ascii=False)
        for interno in ['Conta de luz do galpão', 'Compra interna sigilosa', 'Salário Fulano', 'Salário Beltrana']:
            self.assertNotIn(interno, texto)

    def test_descricao_publica_ou_categoria_e_rh_agregado(self):
        linhas = {linha['descricao']: linha['valor'] for linha in self._portal().data['gastos_mes_lista']}
        self.assertEqual(linhas, {
            'Recursos humanos (2 lançamentos)': 3200.0,
            'Cestas básicas da campanha': 300.0,
            'Administrativo': 80.0,
        })

    def test_sem_doacoes_recentes_nem_nomes_de_doadores(self):
        resp = self._portal()
        self.assertNotIn('doacoes_recentes', resp.data)
        self.assertNotIn('Doador Secreto', json.dumps(resp.data, ensure_ascii=False))
