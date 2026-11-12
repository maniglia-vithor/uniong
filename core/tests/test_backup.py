import shutil
import tarfile
import tempfile
from io import StringIO
from pathlib import Path
from unittest import mock

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from core.management.commands import backup


class BackupTests(TestCase):
    def setUp(self):
        self.pasta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.pasta, ignore_errors=True)
        self.media = self.pasta / 'media'
        self.privado = self.pasta / 'privado'
        (self.media / 'campanhas').mkdir(parents=True)
        (self.media / 'campanhas' / 'capa.png').write_bytes(b'png')
        (self.privado / 'despesas').mkdir(parents=True)
        (self.privado / 'despesas' / 'nota.pdf').write_bytes(b'pdf')

    def rodar(self, **opcoes):
        def falso_dump(destino):
            Path(destino).write_text('-- dump de teste\n', encoding='utf-8')

        with override_settings(MEDIA_ROOT=str(self.media), PRIVATE_MEDIA_ROOT=str(self.privado)), \
                mock.patch.object(backup, 'dump_mysql', side_effect=falso_dump), \
                mock.patch.object(backup, 'dump_sqlite', side_effect=falso_dump):
            call_command('backup', destino=str(self.pasta / 'backups'), stdout=StringIO(), **opcoes)

    def test_gera_arquivo_com_banco_e_midia(self):
        self.rodar()
        arquivos = list((self.pasta / 'backups').glob('uniong_backup_*.tar.gz'))
        self.assertEqual(len(arquivos), 1)
        with tarfile.open(arquivos[0]) as tar:
            nomes = tar.getnames()
        self.assertIn('banco.sql', nomes)
        self.assertIn('media/campanhas/capa.png', nomes)
        self.assertIn('privado/despesas/nota.pdf', nomes)

    def test_mantem_so_os_n_mais_recentes(self):
        destino = self.pasta / 'backups'
        destino.mkdir()
        for dia in range(1, 6):
            (destino / f'uniong_backup_2026-01-0{dia}_060000.tar.gz').write_bytes(b'x')
        (destino / 'outro-arquivo.txt').write_text('não mexer')
        self.rodar(manter=3)
        restantes = sorted(p.name for p in destino.glob('uniong_backup_*.tar.gz'))
        self.assertEqual(len(restantes), 3)
        self.assertNotIn('uniong_backup_2026-01-03_060000.tar.gz', restantes)
        self.assertIn('uniong_backup_2026-01-05_060000.tar.gz', restantes)
        self.assertTrue((destino / 'outro-arquivo.txt').exists())

    def test_manter_invalido(self):
        with self.assertRaises(CommandError):
            self.rodar(manter=0)

    def test_falha_do_mysqldump_vira_erro(self):
        resultado = mock.Mock(returncode=2, stderr=b'Access denied')
        with mock.patch.object(backup.subprocess, 'run', return_value=resultado):
            with self.assertRaisesMessage(CommandError, 'Access denied'):
                backup.dump_mysql(self.pasta / 'x.sql')
