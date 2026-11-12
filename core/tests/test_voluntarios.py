from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from core import indicadores
from core.models import Atividade, InscricaoAtividade, Voluntario

from .factories import criar_staff
from .test_indicadores import relogio


def criar_voluntario(**kw):
    dados = {'nome': 'Voluntário', 'status': 'ativo'}
    dados.update(kw)
    return Voluntario.objects.create(**dados)


class VoluntariosTests(TestCase):
    def setUp(self):
        cache.clear()
        self.cliente = APIClient()
        self.cliente.force_authenticate(criar_staff())

    def inscrever(self, atividade, voluntario):
        return self.cliente.post(f'/api/atividades/{atividade.id}/inscricoes/', {'voluntario': voluntario.id}, format='json')

    def test_limite_de_vagas(self):
        atividade = Atividade.objects.create(titulo='Mutirão', data=date(2026, 3, 1), vagas=2)
        v1, v2, v3 = (criar_voluntario(nome=f'V{i}') for i in range(3))
        self.assertEqual(self.inscrever(atividade, v1).status_code, 201)
        self.assertEqual(self.inscrever(atividade, v1).status_code, 400)  # repetido
        self.assertEqual(self.inscrever(atividade, v2).status_code, 201)
        r = self.inscrever(atividade, v3)
        self.assertEqual(r.status_code, 400)
        self.assertIn('vagas', r.data['erro'])
        self.assertEqual(atividade.inscricoes.count(), 2)
        # reduzir vagas abaixo dos inscritos é recusado
        r = self.cliente.patch(f'/api/atividades/{atividade.id}/', {'vagas': 1}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_inativo_nao_e_inscrito(self):
        atividade = Atividade.objects.create(titulo='Bazar', data=date(2026, 3, 1), vagas=5)
        self.assertEqual(self.inscrever(atividade, criar_voluntario(status='inativo')).status_code, 400)

    def test_soma_de_horas(self):
        v1, v2 = criar_voluntario(nome='Ana'), criar_voluntario(nome='Bia')
        marco = Atividade.objects.create(titulo='Março', data=date(2026, 3, 10), vagas=5)
        abril = Atividade.objects.create(titulo='Abril', data=date(2026, 4, 2), vagas=5)
        for atividade, voluntario, horas in [(marco, v1, '3.5'), (marco, v2, '2'), (abril, v1, '4')]:
            r = self.inscrever(atividade, voluntario)
            p = self.cliente.patch(f'/api/atividades/{atividade.id}/inscricoes/{r.data["id"]}/', {'horas': horas}, format='json')
            self.assertEqual(p.status_code, 200, p.data)
        self.assertEqual(indicadores.horas_voluntariado(date(2026, 3, 1), date(2026, 3, 31)), Decimal('5.5'))
        self.assertEqual(indicadores.horas_voluntariado(), Decimal('9.5'))
        with relogio(2026, 3, 20):
            resumo = indicadores.resumo_painel()
        self.assertEqual(resumo['horas_voluntariado_mes']['value'], 5.5)
        self.assertEqual(resumo['voluntarios_ativos']['value'], 2)
        lista = self.cliente.get('/api/voluntarios/', {'ordering': 'nome'}).data['results']
        self.assertEqual([(v['nome'], v['horas_total']) for v in lista], [('Ana', 7.5), ('Bia', 2.0)])
        self.assertEqual(self.cliente.get(f'/api/atividades/{marco.id}/').data['horas_total'], 5.5)
        portal = APIClient().get('/api/public/transparencia/').data
        self.assertEqual(portal['kpis']['horas_voluntariado'], 9.5)

    def test_horas_validas(self):
        atividade = Atividade.objects.create(titulo='X', data=date(2026, 3, 1), vagas=5)
        r = self.inscrever(atividade, criar_voluntario())
        url = f'/api/atividades/{atividade.id}/inscricoes/{r.data["id"]}/'
        self.assertEqual(self.cliente.patch(url, {'horas': '25'}, format='json').status_code, 400)
        self.assertEqual(self.cliente.patch(url, {'horas': '-1'}, format='json').status_code, 400)
        self.assertEqual(self.cliente.patch(url, {'horas': 'abc'}, format='json').status_code, 400)

    def test_voluntario_com_atividade_nao_e_excluido(self):
        v = criar_voluntario()
        atividade = Atividade.objects.create(titulo='X', data=date(2026, 3, 1), vagas=5)
        InscricaoAtividade.objects.create(atividade=atividade, voluntario=v)
        self.assertEqual(self.cliente.delete(f'/api/voluntarios/{v.id}/').status_code, 400)
