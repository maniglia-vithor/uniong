"""LGPD: anonimização de membro (mantendo as doações para a contabilidade) e exportação dos dados do titular."""
from django.db import transaction
from django.db.models import Value
from django.db.models.functions import Replace
from django.utils import timezone

from .auditoria import registrar
from .documentos import formatar_documento
from .models import LogAlteracao, Notificacao

MARCA = '[dado anonimizado]'


def anonimizar(apoiador, usuario):
    """Substitui os dados pessoais por valores neutros e apaga-os também da trilha de auditoria e das notificações.

    As doações continuam vinculadas ao registro (agora sem identificação), então os totais não mudam.
    """
    nome_original = apoiador.nome
    with transaction.atomic():
        apoiador.nome = f'Membro anonimizado #{apoiador.pk}'
        apoiador.email = f'anonimizado-{apoiador.pk}@anonimizado.invalid'
        apoiador.celular = None
        apoiador.documento = ''
        apoiador.status = 'inativo'
        apoiador.recebe_comunicados = False
        apoiador.anonimizado_em = timezone.now()
        apoiador.save()
        apoiador.contribuicoes.update(ativa=False)
        # A trilha de auditoria guardava os valores antigos (nome, e-mail...): ficam só os nomes dos campos.
        LogAlteracao.objects.filter(modelo='Apoiador', objeto_id=apoiador.pk).update(antes=MARCA, depois=MARCA)
        if nome_original:
            for campo in ('mensagem', 'action_text', 'actor_name'):
                Notificacao.objects.filter(**{f'{campo}__contains': nome_original}).update(
                    **{campo: Replace(campo, Value(nome_original), Value(apoiador.nome))}
                )
        registrar(usuario, apoiador, 'edicao', 'dados pessoais', '', 'anonimizados (LGPD)')
    return apoiador


def exportar(apoiador):
    """Todos os dados do titular guardados pelo sistema, em estrutura serializável (JSON)."""
    doacoes = apoiador.doacoes.select_related('campanha').order_by('data', 'id')
    return {
        'gerado_em': timezone.localtime().isoformat(),
        'titular': {
            'id': apoiador.pk,
            'nome': apoiador.nome,
            'email': apoiador.email,
            'celular': apoiador.celular,
            'documento': formatar_documento(apoiador.documento),
            'status': apoiador.get_status_display(),
            'data_cadastro': apoiador.data_cadastro.isoformat(),
            'recebe_comunicados': apoiador.recebe_comunicados,
            'anonimizado_em': apoiador.anonimizado_em.isoformat() if apoiador.anonimizado_em else None,
        },
        'doacoes': [
            {
                'id': d.pk,
                'data': d.data.isoformat(),
                'tipo': d.get_tipo_display(),
                'valor': str(d.valor),
                'descricao_bens': d.descricao_bens,
                'valor_estimado': str(d.valor_estimado) if d.valor_estimado is not None else None,
                'status': d.get_status_display(),
                'forma_pagamento': d.get_forma_pagamento_display() if d.forma_pagamento else '',
                'campanha': d.campanha.titulo if d.campanha else None,
                'origem': d.get_origem_display(),
                'consentimento_em': d.consentimento_em.isoformat() if d.consentimento_em else None,
                'observacao': d.observacao,
                'recibo': getattr(getattr(d, 'recibo', None), 'numero_formatado', None),
            }
            for d in doacoes
        ],
        'contribuicoes_periodicas': [
            {
                'valor': str(c.valor),
                'periodicidade': c.get_periodicidade_display(),
                'dia_vencimento': c.dia_vencimento,
                'data_inicio': c.data_inicio.isoformat(),
                'ativa': c.ativa,
            }
            for c in apoiador.contribuicoes.order_by('id')
        ],
    }
