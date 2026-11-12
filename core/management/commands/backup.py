"""Backup do banco (mysqldump) e dos arquivos enviados (mídia pública e anexos privados) num único .tar.gz.

Uso: python manage.py backup [--destino PASTA] [--manter N]
Restauração e agendamento: docs/implantacao.md.
"""
import os
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.utils import timezone

PREFIXO = 'uniong_backup_'


def dump_mysql(destino):
    banco = settings.DATABASES['default']
    comando = [
        'mysqldump', '--single-transaction', '--routines', '--no-tablespaces', '--default-character-set=utf8mb4',
        '-h', banco.get('HOST') or 'localhost', '-P', str(banco.get('PORT') or 3306),
        '-u', banco['USER'], banco['NAME'],
    ]
    ambiente = {**os.environ, 'MYSQL_PWD': banco.get('PASSWORD') or ''}  # senha fora da linha de comando
    with open(destino, 'wb') as saida:
        resultado = subprocess.run(comando, stdout=saida, stderr=subprocess.PIPE, env=ambiente)
    if resultado.returncode != 0:
        raise CommandError(f'mysqldump falhou: {resultado.stderr.decode(errors="replace").strip()}')


def dump_sqlite(destino):
    connection.ensure_connection()
    with open(destino, 'w', encoding='utf-8') as saida:
        for linha in connection.connection.iterdump():
            saida.write(f'{linha}\n')


class Command(BaseCommand):
    help = 'Gera backup do banco e dos arquivos enviados, com data no nome, mantendo só os N mais recentes.'

    def add_arguments(self, parser):
        parser.add_argument('--destino', default=settings.BACKUP_DIR, help='Pasta dos backups (padrão: BACKUP_DIR).')
        parser.add_argument('--manter', type=int, default=settings.BACKUP_MANTER, help='Quantos backups manter (padrão: BACKUP_MANTER).')

    def handle(self, *args, destino, manter, **opcoes):
        if manter < 1:
            raise CommandError('--manter deve ser ao menos 1.')
        pasta = Path(destino)
        pasta.mkdir(parents=True, exist_ok=True)
        nome = f'{PREFIXO}{timezone.localtime():%Y-%m-%d_%H%M%S}.tar.gz'
        arquivo = pasta / nome

        with tempfile.TemporaryDirectory() as temporaria:
            sql = Path(temporaria) / 'banco.sql'
            motor = connection.vendor
            if motor == 'mysql':
                dump_mysql(sql)
            elif motor == 'sqlite':
                dump_sqlite(sql)
            else:
                raise CommandError(f'Banco "{motor}" não suportado pelo backup.')
            parcial = arquivo.with_suffix('.parcial')
            with tarfile.open(parcial, 'w:gz') as tar:
                tar.add(sql, arcname='banco.sql')
                for rotulo, origem in (('media', settings.MEDIA_ROOT), ('privado', settings.PRIVATE_MEDIA_ROOT)):
                    if Path(origem).is_dir():
                        tar.add(origem, arcname=rotulo)
            shutil.move(parcial, arquivo)  # só aparece com o nome final quando está completo

        removidos = self.rodar_retencao(pasta, manter)
        self.stdout.write(self.style.SUCCESS(
            f'Backup criado: {arquivo} ({arquivo.stat().st_size / 1024:.0f} KB). Antigos removidos: {removidos}.'
        ))

    @staticmethod
    def rodar_retencao(pasta, manter):
        backups = sorted(pasta.glob(f'{PREFIXO}*.tar.gz'))
        antigos = backups[:-manter]
        for velho in antigos:
            velho.unlink()
        return len(antigos)
