from decimal import Decimal

from django.test import SimpleTestCase

from core.models import Campanha


class PercentualProgressoTests(SimpleTestCase):
    """percentual_progresso e meta_atingida a partir do valor arrecadado anotado."""

    def _campanha(self, meta, arrecadado):
        campanha = Campanha(meta_valor=Decimal(meta))
        campanha.arrecadado = Decimal(arrecadado)
        return campanha

    def test_meta_zero_retorna_zero(self):
        self.assertEqual(self._campanha('0', '500').percentual_progresso, 0)

    def test_metade_da_meta(self):
        self.assertEqual(self._campanha('1000', '500').percentual_progresso, Decimal('50.0'))

    def test_arredonda_em_uma_casa(self):
        self.assertEqual(self._campanha('300', '100').percentual_progresso, Decimal('33.3'))

    def test_acima_da_meta_devolve_valor_real(self):
        campanha = self._campanha('1000', '2500')
        self.assertEqual(campanha.percentual_progresso, Decimal('250.0'))
        self.assertTrue(campanha.meta_atingida)

    def test_sem_arrecadacao(self):
        campanha = self._campanha('1000', '0')
        self.assertEqual(campanha.percentual_progresso, Decimal('0.0'))
        self.assertFalse(campanha.meta_atingida)
