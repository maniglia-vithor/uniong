from django.core.management.base import BaseCommand, CommandError

from core import indicadores
from core.contribuicoes import gerar_doacoes_do_mes


class Command(BaseCommand):
    help = (
        'Cria as doações pendentes das contribuições periódicas ativas do mês (padrão: mês atual). '
        'Pode ser executado várias vezes: não duplica. Agende diariamente, por exemplo no cron: '
        '"0 6 * * * cd /caminho/do/projeto && venv/bin/python manage.py gerar_contribuicoes".'
    )

    def add_arguments(self, parser):
        parser.add_argument('--mes', help='Mês de competência no formato AAAA-MM (padrão: mês atual).')

    def handle(self, *args, **opcoes):
        if opcoes.get('mes'):
            try:
                competencia = indicadores.mes_do_parametro(opcoes['mes'])
            except ValueError:
                raise CommandError('Use o formato AAAA-MM em --mes.')
        else:
            competencia = indicadores.hoje()
        criadas, existentes = gerar_doacoes_do_mes(competencia)
        self.stdout.write(self.style.SUCCESS(
            f'Competência {competencia:%m/%Y}: {criadas} doação(ões) criada(s), {existentes} já existia(m).'
        ))
