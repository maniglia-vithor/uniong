from django.test import TestCase

from core.tests import factories


class FabricasTests(TestCase):
    def test_fabricas_criam_registros_validos(self):
        staff = factories.criar_staff()
        comum = factories.criar_usuario()
        membro = factories.criar_membro()
        campanha = factories.criar_campanha()
        doacao = factories.criar_doacao(apoiador=membro, campanha=campanha)
        despesa = factories.criar_despesa()

        self.assertTrue(staff.is_staff)
        self.assertFalse(comum.is_staff)
        self.assertTrue(comum.check_password('senha-teste-123'))
        self.assertEqual(doacao.apoiador, membro)
        self.assertEqual(despesa.status, 'pendente')
        campanha.refresh_from_db()
        self.assertEqual(campanha.valor_arrecadado, doacao.valor)
