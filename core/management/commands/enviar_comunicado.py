from django.core.management.base import BaseCommand, CommandError

from core import comunicados
from core.models import Comunicado


class Command(BaseCommand):
    help = 'Envia por e-mail um comunicado "Somente Membros" a todos os membros ativos, sem o limite do envio pela tela.'

    def add_arguments(self, parser):
        parser.add_argument('comunicado_id', type=int)

    def handle(self, *args, comunicado_id, **opcoes):
        comunicado = Comunicado.objects.filter(pk=comunicado_id).first()
        if comunicado is None:
            raise CommandError('Comunicado não encontrado.')
        try:
            enviados = comunicados.enviar(comunicado)
        except comunicados.EnvioIndisponivel as e:
            raise CommandError(str(e))
        self.stdout.write(self.style.SUCCESS(f'{enviados} e-mail(s) enviado(s).'))
