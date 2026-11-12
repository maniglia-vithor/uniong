from decimal import Decimal

from django.test import TestCase

from core.models import Campanha


class PercentualProgressoTests(TestCase):
    """Caracterização: documenta o comportamento atual de Campanha.percentual_progresso."""

    def _campanha(self, meta, arrecadado):
        return Campanha(meta_valor=Decimal(meta), valor_arrecadado=Decimal(arrecadado))

    def test_meta_zero_retorna_zero(self):
        self.assertEqual(self._campanha('0', '500').percentual_progresso, 0)

    def test_metade_da_meta(self):
        self.assertEqual(self._campanha('1000', '500').percentual_progresso, Decimal('50.0'))

    def test_arredonda_em_uma_casa(self):
        self.assertEqual(self._campanha('300', '100').percentual_progresso, Decimal('33.3'))

    def test_limitado_a_cem_por_cento(self):
        self.assertEqual(self._campanha('1000', '2500').percentual_progresso, 100)

    def test_sem_arrecadacao(self):
        self.assertEqual(self._campanha('1000', '0').percentual_progresso, Decimal('0.0'))
