from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from core.models import Apoiador, Campanha, Doacao


APOIADORES = [
    ('Ana Beatriz Silva', 'ana.beatriz@email.com'),
    ('Carlos Eduardo Lima', 'carlos.lima@email.com'),
    ('Fernanda Oliveira', 'fernanda.oli@email.com'),
    ('Ricardo Souza', 'ricardo.souza@email.com'),
    ('Juliana Martins', 'juliana.m@email.com'),
    ('Marcos Pereira', 'marcos.p@email.com'),
    ('Patrícia Costa', 'patricia.c@email.com'),
    ('Bruno Alves', 'bruno.alves@email.com'),
    ('Camila Rocha', 'camila.r@email.com'),
    ('Diego Ferreira', 'diego.f@email.com'),
]

CAMPANHAS = [
    ('Alimentação Solidária', 15000, date(2025, 1, 1)),
    ('Escola para Todos', 25000, date(2025, 3, 15)),
    ('Saúde na Comunidade', 10000, date(2025, 6, 1)),
    ('Natal das Crianças', 8000, date(2025, 10, 1)),
]

# Doações fictícias por mês (últimos 12 meses)
DOACOES_MENSAIS = [
    3200, 4100, 2800, 5500, 6200, 4800,
    7100, 5300, 6800, 7500, 8200, 9100,
]


class Command(BaseCommand):
    help = 'APAGA doações, campanhas e membros e popula o banco com dados de demonstração (só com DEBUG=True)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirmar', action='store_true',
            help='Confirma que todas as doações, campanhas e membros atuais serão apagados.',
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('popular_dados só pode ser executado com DEBUG=True (nunca em produção).')
        if not options['confirmar']:
            raise CommandError(
                'Este comando APAGA todas as doações, campanhas e membros. '
                'Execute novamente com --confirmar para prosseguir.'
            )
        self.stdout.write('Limpando dados existentes...')
        Doacao.objects.all().delete()
        Campanha.objects.all().delete()
        Apoiador.objects.all().delete()

        self.stdout.write('Criando apoiadores...')
        apoiadores = []
        for nome, email in APOIADORES:
            a = Apoiador.objects.create(nome=nome, email=email, status='ativo')
            apoiadores.append(a)

        self.stdout.write('Criando campanhas...')
        campanhas = []
        for titulo, meta, inicio in CAMPANHAS:
            c = Campanha.objects.create(
                titulo=titulo,
                meta_valor=meta,
                valor_arrecadado=0,
                status='ativa',
                data_inicio=inicio,
            )
            campanhas.append(c)

        self.stdout.write('Criando doações (12 meses)...')
        hoje = date.today()
        apoiador_idx = 0

        for i, total_mes in enumerate(DOACOES_MENSAIS):
            inicio_mes = (hoje - relativedelta(months=11 - i)).replace(day=1)
            num_doacoes = 4
            valor_por_doacao = total_mes / num_doacoes

            for j in range(num_doacoes):
                dia = inicio_mes + timedelta(days=j * 6)
                apoiador = apoiadores[apoiador_idx % len(apoiadores)]
                campanha = campanhas[j % len(campanhas)]

                Doacao.objects.create(
                    apoiador=apoiador,
                    campanha=campanha,
                    valor=round(valor_por_doacao, 2),
                    data=dia,
                    status='confirmada',
                )
                apoiador_idx += 1

        # Algumas doações recentes com status variados
        Doacao.objects.create(
            apoiador=apoiadores[0], campanha=campanhas[0],
            valor=500, data=hoje - timedelta(days=1), status='confirmada'
        )
        Doacao.objects.create(
            apoiador=apoiadores[1], campanha=campanhas[1],
            valor=1200, data=hoje - timedelta(days=2), status='confirmada'
        )
        Doacao.objects.create(
            apoiador=apoiadores[2], campanha=None,
            valor=300, data=hoje - timedelta(days=3), status='pendente'
        )
        Doacao.objects.create(
            apoiador=apoiadores[3], campanha=campanhas[2],
            valor=750, data=hoje - timedelta(days=4), status='confirmada'
        )
        Doacao.objects.create(
            apoiador=apoiadores[4], campanha=campanhas[3],
            valor=200, data=hoje - timedelta(days=5), status='cancelada'
        )

        self.stdout.write(self.style.SUCCESS(
            f'\nDados criados com sucesso!\n'
            f'  {Apoiador.objects.count()} apoiadores\n'
            f'  {Campanha.objects.count()} campanhas\n'
            f'  {Doacao.objects.count()} doações\n'
        ))
