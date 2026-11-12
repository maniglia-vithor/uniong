import uuid
from decimal import Decimal

from dateutil.relativedelta import relativedelta

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .anexos import armazenamento_privado, caminho_anexo


class Apoiador(models.Model):
    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('inativo', 'Inativo'),
        # Criado pelo portal público; vira "ativo" quando a primeira doação é confirmada.
        ('interessado', 'Interessado'),
    ]

    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    celular = models.CharField(max_length=20, null=True, blank=True)
    data_cadastro = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='ativo')

    class Meta:
        verbose_name = 'Apoiador'
        verbose_name_plural = 'Apoiadores'
        ordering = ['-data_cadastro']

    def __str__(self):
        return self.nome


def _soma_por_campanha(modelo, **filtros):
    """Subconsulta: soma de `valor` do modelo vinculado à campanha externa (evita JOIN que duplica somas)."""
    subconsulta = (
        modelo.objects.filter(campanha=OuterRef('pk'), **filtros)
        .order_by().values('campanha').annotate(total=Sum('valor')).values('total')
    )
    return Coalesce(
        Subquery(subconsulta, output_field=models.DecimalField(max_digits=14, decimal_places=2)),
        Value(Decimal('0')),
        output_field=models.DecimalField(max_digits=14, decimal_places=2),
    )


class CampanhaQuerySet(models.QuerySet):
    def com_arrecadado(self):
        """Anota `arrecadado` (doações confirmadas) e `gasto` (despesas pagas vinculadas)."""
        return self.annotate(
            arrecadado=_soma_por_campanha(Doacao, status='confirmada'),
            gasto=_soma_por_campanha(Despesa, status='pago'),
        )


class Campanha(models.Model):
    STATUS_CHOICES = [
        ('ativa', 'Ativa'),
        ('encerrada', 'Encerrada'),
        ('pausada', 'Pausada'),
    ]

    titulo = models.CharField(max_length=200)
    meta_valor = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ativa')
    data_inicio = models.DateField()
    data_fim = models.DateField(null=True, blank=True)
    descricao = models.TextField(blank=True)

    objects = CampanhaQuerySet.as_manager()

    class Meta:
        verbose_name = 'Campanha'
        verbose_name_plural = 'Campanhas'
        ordering = ['-data_inicio']

    @property
    def valor_arrecadado(self):
        if hasattr(self, 'arrecadado'):
            return self.arrecadado
        if self.pk is None:
            return Decimal('0')
        total = self.doacoes.filter(status='confirmada').aggregate(total=Sum('valor'))['total']
        return total or Decimal('0')

    @property
    def percentual_progresso(self):
        if not self.meta_valor:
            return 0
        return round((self.valor_arrecadado / self.meta_valor) * 100, 1)

    @property
    def meta_atingida(self):
        return bool(self.meta_valor) and self.valor_arrecadado >= self.meta_valor

    @property
    def valor_gasto(self):
        if hasattr(self, 'gasto'):
            return self.gasto
        if self.pk is None:
            return Decimal('0')
        return self.despesas.filter(status='pago').aggregate(total=Sum('valor'))['total'] or Decimal('0')

    @property
    def saldo(self):
        return self.valor_arrecadado - self.valor_gasto

    def __str__(self):
        return self.titulo


class Notificacao(models.Model):
    TIPO_CHOICES = [
        ('doacao', 'Doação'),
        ('campanha', 'Campanha'),
        ('apoiador', 'Apoiador'),
        ('despesa', 'Despesa'),
        ('configuracao', 'Configuração'),
    ]

    usuario = models.ForeignKey(
        get_user_model(), on_delete=models.CASCADE, related_name='notificacoes'
    )
    mensagem = models.CharField(max_length=300)
    tipo = models.CharField(max_length=12, choices=TIPO_CHOICES, default='doacao')
    lida = models.BooleanField(default=False)
    criada_em = models.DateTimeField(auto_now_add=True)
    actor_name = models.CharField(max_length=150, blank=True, default='')
    action_text = models.CharField(max_length=200, blank=True, default='')
    target_type = models.CharField(max_length=10, blank=True, default='')
    target_id = models.IntegerField(null=True, blank=True)

    class Meta:
        verbose_name = 'Notificação'
        verbose_name_plural = 'Notificações'
        ordering = ['-criada_em']

    def __str__(self):
        return self.mensagem


class Doacao(models.Model):
    STATUS_CHOICES = [
        ('confirmada', 'Confirmada'),
        ('pendente', 'Pendente'),
        ('cancelada', 'Cancelada'),
    ]

    apoiador = models.ForeignKey(
        Apoiador, on_delete=models.PROTECT, related_name='doacoes'
    )
    campanha = models.ForeignKey(
        Campanha, on_delete=models.PROTECT, null=True, blank=True, related_name='doacoes'
    )
    ORIGEM_CHOICES = [
        ('painel', 'Painel'),
        ('portal', 'Portal público'),
    ]

    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='confirmada')
    origem = models.CharField(max_length=10, choices=ORIGEM_CHOICES, default='painel')
    consentimento_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Doação'
        verbose_name_plural = 'Doações'
        ordering = ['-data']

    def __str__(self):
        return f'R$ {self.valor} — {self.apoiador.nome} em {self.data}'


class Despesa(models.Model):
    CATEGORIA_CHOICES = [
        ('administrativo', 'Administrativo'),
        ('recursos_humanos', 'Recursos Humanos'),
        ('projetos', 'Projetos'),
        ('captacao', 'Captação de Recursos'),
        ('outros', 'Outros'),
    ]
    # "Atrasado" não é gravado: é a pendente com vencimento anterior a hoje (status_efetivo).
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('pago', 'Pago'),
        ('cancelado', 'Cancelado'),
    ]
    RECORRENCIA_CHOICES = [
        ('mensal', 'Mensal'),
        ('semanal', 'Semanal'),
        ('anual', 'Anual'),
    ]

    descricao = models.CharField(max_length=200)
    # Texto exibido no portal; vazio → o portal mostra só a categoria.
    descricao_publica = models.CharField(max_length=200, blank=True, default='')
    campanha = models.ForeignKey(
        'Campanha', on_delete=models.PROTECT, null=True, blank=True, related_name='despesas'
    )
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='outros')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pendente')
    is_fixed = models.BooleanField(default=False)
    recurrence_period = models.CharField(
        max_length=10, choices=RECORRENCIA_CHOICES, null=True, blank=True
    )
    # Série de despesas fixas: cada ocorrência é calculada a partir da data-âncora (não da anterior).
    serie_id = models.UUIDField(null=True, blank=True, db_index=True)
    data_ancora = models.DateField(null=True, blank=True)
    numero_ocorrencia = models.PositiveIntegerField(default=0)
    recorrencia_fim = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Despesa'
        verbose_name_plural = 'Despesas'
        ordering = ['-data_vencimento']
        constraints = [
            # Despesas avulsas têm serie_id nulo; NULL não conflita em restrição única.
            models.UniqueConstraint(fields=['serie_id', 'numero_ocorrencia'], name='ocorrencia_unica_por_serie'),
        ]

    def save(self, *args, **kwargs):
        if self.is_fixed and self.recurrence_period and self.serie_id is None:
            self.serie_id = uuid.uuid4()
            self.data_ancora = self.data_vencimento
            self.numero_ocorrencia = 0
        super().save(*args, **kwargs)

    def status_efetivo(self):
        """Retorna 'atrasado' se pendente e vencida, independente do campo salvo."""
        if self.status == 'pendente' and self.data_vencimento < timezone.localdate():
            return 'atrasado'
        return self.status

    PASSOS_RECORRENCIA = {'mensal': 'months', 'semanal': 'weeks', 'anual': 'years'}

    def data_da_ocorrencia(self, numero):
        """Vencimento da n-ésima ocorrência: âncora + n períodos (31/01 → 28/02 → 31/03)."""
        passo = self.PASSOS_RECORRENCIA.get(self.recurrence_period)
        if passo is None or self.data_ancora is None:
            return None
        return self.data_ancora + relativedelta(**{passo: numero})

    def gerar_proxima_recorrencia(self):
        """Cria a próxima ocorrência da série (só se ainda não existir e não passar do fim). Devolve a criada ou None."""
        if not self.is_fixed or not self.recurrence_period or self.serie_id is None:
            return None
        numero = self.numero_ocorrencia + 1
        vencimento = self.data_da_ocorrencia(numero)
        if vencimento is None or (self.recorrencia_fim and vencimento > self.recorrencia_fim):
            return None
        if Despesa.objects.filter(serie_id=self.serie_id, numero_ocorrencia=numero).exists():
            return None
        return Despesa.objects.create(
            descricao=self.descricao,
            valor=self.valor,
            categoria=self.categoria,
            data_vencimento=vencimento,
            status='pendente',
            is_fixed=True,
            recurrence_period=self.recurrence_period,
            serie_id=self.serie_id,
            data_ancora=self.data_ancora,
            numero_ocorrencia=numero,
            recorrencia_fim=self.recorrencia_fim,
        )

    def encerrar_serie(self, fim):
        """Define o fim da série e apaga as ocorrências pendentes que vencem depois dele. Devolve quantas apagou."""
        serie = Despesa.objects.filter(serie_id=self.serie_id)
        serie.update(recorrencia_fim=fim)
        apagadas, _ = serie.filter(status='pendente', data_vencimento__gt=fim).delete()
        return apagadas

    def aplicar_valor_as_proximas(self):
        """Copia o valor desta ocorrência para as ocorrências pendentes seguintes da série."""
        return Despesa.objects.filter(
            serie_id=self.serie_id, numero_ocorrencia__gt=self.numero_ocorrencia, status='pendente',
        ).update(valor=self.valor)

    def __str__(self):
        return f'{self.descricao} — R$ {self.valor}'


class DespesaAnexo(models.Model):
    despesa = models.ForeignKey(
        Despesa, on_delete=models.CASCADE, related_name='anexos'
    )
    arquivo = models.FileField(upload_to=caminho_anexo, storage=armazenamento_privado)
    nome_original = models.CharField(max_length=255, blank=True)
    enviado_em = models.DateTimeField(auto_now_add=True)
    # Marcado pelo administrador: o comprovante pode ser baixado no portal de transparência.
    publico = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'Anexo de Despesa'
        verbose_name_plural = 'Anexos de Despesa'
        ordering = ['enviado_em']

    def save(self, *args, **kwargs):
        if not self.nome_original and self.arquivo:
            import os
            self.nome_original = os.path.basename(self.arquivo.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Anexo de {self.despesa}'


class LogAlteracao(models.Model):
    """Registro de auditoria: quem alterou qual campo de qual registro."""

    ACAO_CHOICES = [
        ('criacao', 'Criação'),
        ('edicao', 'Edição'),
        ('exclusao', 'Exclusão'),
    ]

    usuario = models.ForeignKey(
        get_user_model(), on_delete=models.SET_NULL, null=True, blank=True, related_name='alteracoes'
    )
    acao = models.CharField(max_length=10, choices=ACAO_CHOICES, default='edicao')
    data = models.DateTimeField(auto_now_add=True)
    modelo = models.CharField(max_length=50)
    objeto_id = models.PositiveIntegerField(null=True, blank=True)
    campo = models.CharField(max_length=50)
    antes = models.TextField(blank=True, default='')
    depois = models.TextField(blank=True, default='')

    class Meta:
        verbose_name = 'Log de alteração'
        verbose_name_plural = 'Logs de alteração'
        ordering = ['-data']

    def __str__(self):
        return f'{self.modelo}#{self.objeto_id} {self.campo} ({self.data:%d/%m/%Y %H:%M})'


class ConfiguracaoInstituicao(models.Model):
    """Registro único com as configurações da instituição (ampliado na fase 5)."""

    portal_ativo = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Configuração da instituição'
        verbose_name_plural = 'Configuração da instituição'

    @classmethod
    def obter(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Configuração da instituição'


class ConfiguracaoPix(models.Model):
    """Registro único com a chave PIX da instituição."""

    chave = models.CharField(max_length=77, blank=True, default='')
    nome_recebedor = models.CharField(max_length=25, blank=True, default='')
    cidade = models.CharField(max_length=15, blank=True, default='')

    class Meta:
        verbose_name = 'Configuração PIX'
        verbose_name_plural = 'Configuração PIX'

    @classmethod
    def obter(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return self.chave or '(sem chave PIX)'


class Comunicado(models.Model):
    PUBLICO_CHOICES = [
        ('publico', 'Público'),
        ('apoiadores', 'Somente Apoiadores'),
    ]

    titulo = models.CharField(max_length=200)
    conteudo = models.TextField()
    data_publicacao = models.DateTimeField(auto_now_add=True)
    publico_alvo = models.CharField(max_length=12, choices=PUBLICO_CHOICES, default='publico')

    class Meta:
        verbose_name = 'Comunicado'
        verbose_name_plural = 'Comunicados'
        ordering = ['-data_publicacao']

    def __str__(self):
        return self.titulo

