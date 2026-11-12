import os
import secrets
import subprocess
import sys

from django.conf import settings
from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, TestCase, override_settings

from core.models import Apoiador
from core.tests.factories import criar_membro

PRODUCAO = {
    'DEBUG': 'False',
    'SECRET_KEY': secrets.token_urlsafe(50),
    'ALLOWED_HOSTS': 'uniong.exemplo.org',
    'CORS_ALLOWED_ORIGINS': 'https://uniong.exemplo.org',
}


def _manage(env_extra, *args):
    env = {**os.environ, **env_extra}
    return subprocess.run(
        [sys.executable, 'manage.py', *args],
        cwd=settings.BASE_DIR, env=env, capture_output=True, text=True, timeout=120,
    )


class ConfiguracaoProducaoTests(SimpleTestCase):
    def test_variaveis_obrigatorias_com_debug_false(self):
        for nome in ['SECRET_KEY', 'ALLOWED_HOSTS', 'CORS_ALLOWED_ORIGINS']:
            with self.subTest(variavel=nome):
                r = _manage({**PRODUCAO, nome: ''}, 'check')
                self.assertNotEqual(r.returncode, 0)
                self.assertIn(f'Defina {nome} no .env', r.stderr)

    def test_check_deploy_sem_avisos_relevantes(self):
        r = _manage(PRODUCAO, 'check', '--deploy')
        self.assertEqual(r.returncode, 0, r.stderr)
        avisos = [linha for linha in (r.stdout + r.stderr).splitlines() if '(security.' in linha]
        self.assertEqual([a for a in avisos if 'security.W021' not in a], [])


class PopularDadosTests(TestCase):
    def test_recusa_com_debug_false(self):
        criar_membro()
        with override_settings(DEBUG=False):
            with self.assertRaisesMessage(CommandError, 'DEBUG=True'):
                call_command('popular_dados', '--confirmar')
        self.assertEqual(Apoiador.objects.count(), 1)

    def test_exige_confirmar(self):
        criar_membro()
        with override_settings(DEBUG=True):
            with self.assertRaisesMessage(CommandError, '--confirmar'):
                call_command('popular_dados')
        self.assertEqual(Apoiador.objects.count(), 1)
