from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from .anexos import armazenamento_privado, caminho_anexo


class Apoiador(models.Model):
    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('inativo', 'Inativo'),
    ]

    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    celular = models.CharField(max_length=20, null=True, blank=True)
    data_cadastro = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ativo')

    class Meta:
        verbose_name = 'Apoiador'
        verbose_name_plural = 'Apoiadores'
        ordering = ['-data_cadastro']

    def __str__(self):
        return self.nome


class CampanhaQuerySet(models.QuerySet):
    def com_arrecadado(self):
        """Anota `arrecadado`: soma das doações confirmadas da campanha."""
        return self.annotate(
            arrecadado=Coalesce(
                Sum('doacoes__valor', filter=Q(doacoes__status='confirmada')),
                Value(Decimal('0')),
                output_field=models.DecimalField(max_digits=14, decimal_places=2),
            )
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

    def __str__(self):
        return self.titulo


class Notificacao(models.Model):
    TIPO_CHOICES = [
        ('doacao', 'Doação'),
        ('campanha', 'Campanha'),
        ('apoiador', 'Apoiador'),
        ('despesa', 'Despesa'),
        ('config', 'Configuração'),
    ]

    usuario = models.ForeignKey(
        get_user_model(), on_delete=models.CASCADE, related_name='notificacoes'
    )
    mensagem = models.CharField(max_length=300)
    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES, default='doacao')
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
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='confirmada')

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
    ]
    RECORRENCIA_CHOICES = [
        ('mensal', 'Mensal'),
        ('semanal', 'Semanal'),
        ('anual', 'Anual'),
    ]

    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='outros')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pendente')
    is_fixed = models.BooleanField(default=False)
    recurrence_period = models.CharField(
        max_length=10, choices=RECORRENCIA_CHOICES, null=True, blank=True
    )

    class Meta:
        verbose_name = 'Despesa'
        verbose_name_plural = 'Despesas'
        ordering = ['-data_vencimento']

    def status_efetivo(self):
        """Retorna 'atrasado' se pendente e vencida, independente do campo salvo."""
        if self.status == 'pendente' and self.data_vencimento < timezone.localdate():
            return 'atrasado'
        return self.status

    def _proxima_data_vencimento(self):
        from dateutil.relativedelta import relativedelta
        if self.recurrence_period == 'mensal':
            return self.data_vencimento + relativedelta(months=1)
        if self.recurrence_period == 'semanal':
            from datetime import timedelta
            return self.data_vencimento + timedelta(weeks=1)
        if self.recurrence_period == 'anual':
            return self.data_vencimento + relativedelta(years=1)
        return None

    def gerar_proxima_recorrencia(self):
        """Cria a próxima despesa recorrente se ainda não existir."""
        if not self.is_fixed or not self.recurrence_period:
            return
        proxima = self._proxima_data_vencimento()
        if proxima is None:
            return
        ja_existe = Despesa.objects.filter(
            descricao=self.descricao,
            is_fixed=True,
            data_vencimento=proxima,
        ).exists()
        if not ja_existe:
            Despesa.objects.create(
                descricao=self.descricao,
                valor=self.valor,
                categoria=self.categoria,
                data_vencimento=proxima,
                status='pendente',
                is_fixed=True,
                recurrence_period=self.recurrence_period,
            )

    def __str__(self):
        return f'{self.descricao} — R$ {self.valor}'


class DespesaAnexo(models.Model):
    despesa = models.ForeignKey(
        Despesa, on_delete=models.CASCADE, related_name='anexos'
    )
    arquivo = models.FileField(upload_to=caminho_anexo, storage=armazenamento_privado)
    nome_original = models.CharField(max_length=255, blank=True)
    enviado_em = models.DateTimeField(auto_now_add=True)

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

    usuario = models.ForeignKey(
        get_user_model(), on_delete=models.SET_NULL, null=True, blank=True, related_name='alteracoes'
    )
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

