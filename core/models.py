from django.db import models
from django.contrib.auth import get_user_model


class Apoiador(models.Model):
    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('inativo', 'Inativo'),
    ]

    nome = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    data_cadastro = models.DateField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ativo')

    class Meta:
        verbose_name = 'Apoiador'
        verbose_name_plural = 'Apoiadores'
        ordering = ['-data_cadastro']

    def __str__(self):
        return self.nome


class Campanha(models.Model):
    STATUS_CHOICES = [
        ('ativa', 'Ativa'),
        ('encerrada', 'Encerrada'),
        ('pausada', 'Pausada'),
    ]

    titulo = models.CharField(max_length=200)
    meta_valor = models.DecimalField(max_digits=12, decimal_places=2)
    valor_arrecadado = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ativa')
    data_inicio = models.DateField()
    data_fim = models.DateField(null=True, blank=True)
    descricao = models.TextField(blank=True)

    class Meta:
        verbose_name = 'Campanha'
        verbose_name_plural = 'Campanhas'
        ordering = ['-data_inicio']

    @property
    def percentual_progresso(self):
        if self.meta_valor == 0:
            return 0
        return min(round((self.valor_arrecadado / self.meta_valor) * 100, 1), 100)

    def __str__(self):
        return self.titulo


class Notificacao(models.Model):
    TIPO_CHOICES = [
        ('doacao', 'Doação'),
        ('campanha', 'Campanha'),
        ('apoiador', 'Apoiador'),
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
        Campanha, on_delete=models.SET_NULL, null=True, blank=True, related_name='doacoes'
    )
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    data = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='confirmada')

    class Meta:
        verbose_name = 'Doação'
        verbose_name_plural = 'Doações'
        ordering = ['-data']

    def save(self, *args, **kwargs):
        # Atualiza valor_arrecadado da campanha ao confirmar/cancelar doação
        is_new = self.pk is None
        old_status = None
        old_valor = None

        if not is_new:
            old = Doacao.objects.get(pk=self.pk)
            old_status = old.status
            old_valor = old.valor

        super().save(*args, **kwargs)

        if self.campanha:
            self._atualizar_campanha(is_new, old_status, old_valor)

    def _atualizar_campanha(self, is_new, old_status, old_valor):
        campanha = self.campanha
        if is_new:
            if self.status == 'confirmada':
                campanha.valor_arrecadado += self.valor
        else:
            # Remove contribuição antiga se era confirmada
            if old_status == 'confirmada':
                campanha.valor_arrecadado -= old_valor
            # Adiciona nova contribuição se agora é confirmada
            if self.status == 'confirmada':
                campanha.valor_arrecadado += self.valor
        campanha.save()

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
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('pago', 'Pago'),
        ('atrasado', 'Atrasado'),
    ]

    descricao = models.CharField(max_length=200)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    data_vencimento = models.DateField()
    data_pagamento = models.DateField(null=True, blank=True)
    categoria = models.CharField(max_length=20, choices=CATEGORIA_CHOICES, default='outros')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pendente')

    class Meta:
        verbose_name = 'Despesa'
        verbose_name_plural = 'Despesas'
        ordering = ['-data_vencimento']

    def status_efetivo(self):
        """Retorna 'atrasado' se pendente e vencida, independente do campo salvo."""
        from datetime import date
        if self.status == 'pendente' and self.data_vencimento < date.today():
            return 'atrasado'
        return self.status

    def __str__(self):
        return f'{self.descricao} — R$ {self.valor}'


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
