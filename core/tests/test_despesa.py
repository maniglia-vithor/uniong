from datetime import timedelta

from django.test import SimpleTestCase
from django.utils import timezone

from core.models import Despesa


class StatusEfetivoTests(SimpleTestCase):
    """Caracterização: documenta o comportamento atual de Despesa.status_efetivo()."""

    def _despesa(self, status, dias_ate_vencimento):
        return Despesa(status=status, data_vencimento=timezone.localdate() + timedelta(days=dias_ate_vencimento))

    def test_pendente_vencida_vira_atrasado(self):
        self.assertEqual(self._despesa('pendente', -1).status_efetivo(), 'atrasado')

    def test_pendente_que_vence_hoje_continua_pendente(self):
        self.assertEqual(self._despesa('pendente', 0).status_efetivo(), 'pendente')

    def test_pendente_futura_continua_pendente(self):
        self.assertEqual(self._despesa('pendente', 5).status_efetivo(), 'pendente')

    def test_paga_vencida_continua_paga(self):
        self.assertEqual(self._despesa('pago', -10).status_efetivo(), 'pago')

