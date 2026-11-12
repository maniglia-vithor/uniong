"""Voluntários, atividades, inscrições (com limite de vagas) e registro de horas."""
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import Count, Sum
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .auditoria import AuditoriaMixin, registrar
from .models import Atividade, InscricaoAtividade, Voluntario
from .normalizacao import normalizar_celular, normalizar_email
from .paginacao import filtrar_periodo

HORAS_MAXIMAS = Decimal('24')


class VagasEsgotadas(Exception):
    pass


class VoluntarioSerializer(serializers.ModelSerializer):
    apoiador_nome = serializers.CharField(source='apoiador.nome', read_only=True, default=None)
    horas_total = serializers.SerializerMethodField()

    class Meta:
        model = Voluntario
        fields = [
            'id', 'apoiador', 'apoiador_nome', 'nome', 'email', 'telefone', 'areas_interesse',
            'disponibilidade', 'status', 'criado_em', 'horas_total',
        ]
        read_only_fields = ['criado_em']

    def get_horas_total(self, obj):
        total = getattr(obj, 'horas_total', None)
        if total is None:
            total = obj.inscricoes.aggregate(t=Sum('horas'))['t']
        return float(total or 0)

    def validate_email(self, value):
        return normalizar_email(value) if value else ''

    def validate_telefone(self, value):
        try:
            return normalizar_celular(value) or ''
        except ValueError:
            raise serializers.ValidationError('Telefone inválido. Informe DDD e número (10 ou 11 dígitos).')


class AtividadeSerializer(serializers.ModelSerializer):
    inscritos = serializers.IntegerField(read_only=True, default=0)
    horas_total = serializers.SerializerMethodField()

    class Meta:
        model = Atividade
        fields = ['id', 'titulo', 'data', 'local', 'descricao', 'vagas', 'inscritos', 'horas_total']

    def get_horas_total(self, obj):
        total = getattr(obj, 'horas_soma', None)
        return float(total or 0)

    def validate_vagas(self, value):
        if value < 1:
            raise serializers.ValidationError('Informe ao menos 1 vaga.')
        if self.instance is not None and value < self.instance.inscricoes.count():
            raise serializers.ValidationError('Já há mais inscritos do que esse número de vagas.')
        return value


class InscricaoSerializer(serializers.ModelSerializer):
    voluntario_nome = serializers.CharField(source='voluntario.nome', read_only=True)

    class Meta:
        model = InscricaoAtividade
        fields = ['id', 'voluntario', 'voluntario_nome', 'horas', 'inscrito_em']
        read_only_fields = ['inscrito_em']


def validar_horas(valor):
    if valor in (None, ''):
        return None
    try:
        horas = Decimal(str(valor))
    except Exception:
        raise serializers.ValidationError({'horas': 'Informe as horas como número (ex.: 3.5).'})
    if horas < 0 or horas > HORAS_MAXIMAS:
        raise serializers.ValidationError({'horas': 'As horas devem estar entre 0 e 24.'})
    return horas


def inscrever(atividade, voluntario):
    """Inscreve respeitando o limite de vagas (a linha da atividade fica bloqueada durante a contagem)."""
    if voluntario.status != 'ativo':
        raise serializers.ValidationError({'voluntario': 'Só voluntários ativos podem ser inscritos.'})
    with transaction.atomic():
        atividade = Atividade.objects.select_for_update().get(pk=atividade.pk)
        if atividade.inscricoes.filter(voluntario=voluntario).exists():
            raise serializers.ValidationError({'voluntario': 'Este voluntário já está inscrito.'})
        if atividade.inscricoes.count() >= atividade.vagas:
            raise VagasEsgotadas('Não há mais vagas nesta atividade.')
        try:
            return InscricaoAtividade.objects.create(atividade=atividade, voluntario=voluntario)
        except IntegrityError:
            raise serializers.ValidationError({'voluntario': 'Este voluntário já está inscrito.'})


class VoluntarioViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = VoluntarioSerializer
    search_fields = ['nome', 'email', 'areas_interesse']
    ordering_fields = ['nome', 'status', 'criado_em', 'horas_total']
    ordering = ['nome', 'id']

    def get_queryset(self):
        qs = Voluntario.objects.select_related('apoiador').annotate(horas_total=Sum('inscricoes__horas'))
        status = self.request.query_params.get('status')
        return qs.filter(status=status) if status else qs

    def destroy(self, request, *args, **kwargs):
        if self.get_object().inscricoes.exists():
            return Response({'erro': 'Não é possível excluir: o voluntário tem atividades registradas. Inative-o.'}, status=400)
        return super().destroy(request, *args, **kwargs)


class AtividadeViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = AtividadeSerializer
    search_fields = ['titulo', 'local', 'descricao']
    ordering_fields = ['titulo', 'data', 'vagas']
    ordering = ['-data', '-id']

    def get_queryset(self):
        qs = Atividade.objects.annotate(inscritos=Count('inscricoes', distinct=True), horas_soma=Sum('inscricoes__horas'))
        return filtrar_periodo(qs, self.request, 'data')

    @action(detail=True, methods=['get', 'post'])
    def inscricoes(self, request, pk=None):
        """GET lista os inscritos; POST {"voluntario": id} inscreve (respeitando as vagas)."""
        atividade = self.get_object()
        if request.method == 'GET':
            return Response(InscricaoSerializer(atividade.inscricoes.select_related('voluntario'), many=True).data)
        voluntario = Voluntario.objects.filter(pk=request.data.get('voluntario')).first()
        if voluntario is None:
            return Response({'voluntario': 'Voluntário não encontrado.'}, status=400)
        try:
            inscricao = inscrever(atividade, voluntario)
        except VagasEsgotadas as e:
            return Response({'erro': str(e)}, status=400)
        registrar(request.user, atividade, 'edicao', 'inscrição', '', voluntario.nome)
        return Response(InscricaoSerializer(inscricao).data, status=201)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'inscricoes/(?P<inscricao_id>\d+)')
    def inscricao(self, request, pk=None, inscricao_id=None):
        """PATCH {"horas": n} registra as horas trabalhadas; DELETE cancela a inscrição."""
        inscricao = InscricaoAtividade.objects.select_related('voluntario').filter(pk=inscricao_id, atividade_id=pk).first()
        if inscricao is None:
            return Response({'erro': 'Inscrição não encontrada.'}, status=404)
        if request.method == 'DELETE':
            registrar(request.user, inscricao.atividade, 'edicao', 'inscrição', inscricao.voluntario.nome, '')
            inscricao.delete()
            return Response(status=204)
        horas = validar_horas(request.data.get('horas'))
        antes = inscricao.horas
        inscricao.horas = horas
        inscricao.save(update_fields=['horas'])
        registrar(request.user, inscricao.atividade, 'edicao', f'horas de {inscricao.voluntario.nome}', str(antes or ''), str(horas or ''))
        return Response(InscricaoSerializer(inscricao).data)
