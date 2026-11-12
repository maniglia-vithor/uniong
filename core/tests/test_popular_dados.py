from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings

from core.models import Campanha, Despesa, Recibo

from .factories import criar_campanha, criar_despesa, criar_doacao


@override_settings(DEBUG=True)
class PopularDadosTests(TestCase):
    def test_roda_mesmo_com_recibo_e_despesa_vinculada(self):
        campanha = criar_campanha()
        Recibo.objects.create(doacao=criar_doacao(campanha=campanha))
        despesa = criar_despesa(campanha=campanha)
        call_command('popular_dados', '--confirmar', stdout=StringIO())
        self.assertFalse(Recibo.objects.exists())
        self.assertFalse(Campanha.objects.filter(pk=campanha.pk).exists())
        despesa.refresh_from_db()
        self.assertIsNone(despesa.campanha_id)
