"""Recibos de doação: emissão (número sequencial), dados para impressão e envio por e-mail."""
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.html import escape

from .documentos import formatar_documento
from .extenso import reais_por_extenso
from .models import ConfiguracaoInstituicao, Recibo
from .serializers import dados_publicos_instituicao


class ReciboIndisponivel(Exception):
    pass


def emitir(doacao, usuario):
    """Devolve o recibo da doação, criando-o na primeira vez. Reemitir mantém o mesmo número."""
    if doacao.status != 'confirmada':
        raise ReciboIndisponivel('Só é possível emitir recibo de doação confirmada.')
    existente = Recibo.objects.filter(doacao=doacao).first()
    if existente:
        return existente
    try:
        with transaction.atomic():
            return Recibo.objects.create(doacao=doacao, emitido_por=usuario if usuario.is_authenticated else None)
    except IntegrityError:  # duas emissões simultâneas da mesma doação
        return Recibo.objects.get(doacao=doacao)


def dados_recibo(recibo):
    doacao = recibo.doacao
    membro = doacao.apoiador
    bens = doacao.tipo == 'bens'
    return {
        'numero': recibo.numero,
        'numero_formatado': recibo.numero_formatado,
        'emitido_em': timezone.localtime(recibo.emitido_em).isoformat(),
        'enviado_para': recibo.enviado_para,
        'enviado_em': recibo.enviado_em.isoformat() if recibo.enviado_em else None,
        'instituicao': dados_publicos_instituicao(ConfiguracaoInstituicao.obter()),
        'doacao': {
            'id': doacao.id,
            'tipo': doacao.tipo,
            'valor': float(doacao.valor),
            'valor_extenso': None if bens else reais_por_extenso(doacao.valor),
            'descricao_bens': doacao.descricao_bens,
            'valor_estimado': float(doacao.valor_estimado) if doacao.valor_estimado is not None else None,
            'data': doacao.data.isoformat(),
            'forma_pagamento': doacao.get_forma_pagamento_display() if doacao.forma_pagamento else '',
            'campanha': doacao.campanha.titulo if doacao.campanha else None,
        },
        'doador': {
            'nome': doacao.nome_doador,
            'documento': formatar_documento(membro.documento) if membro else '',
            'email': membro.email if membro else '',
        },
    }


def _moeda(valor):
    return f'R$ {valor:,.2f}'.replace(',', 'X').replace('.', ',').replace('X', '.')


def texto_recibo(dados):
    inst = dados['instituicao']
    d = dados['doacao']
    doador = dados['doador']
    nome_inst = inst['nome'] or 'a organização'
    quem = doador['nome'] + (f" (CPF/CNPJ {doador['documento']})" if doador['documento'] else '')
    data = '/'.join(reversed(d['data'].split('-')))
    if d['tipo'] == 'bens':
        objeto = f"a doação dos seguintes bens: {d['descricao_bens']}"
        if d['valor_estimado']:
            objeto += f" (valor estimado de {_moeda(d['valor_estimado'])})"
    else:
        objeto = f"a importância de {_moeda(d['valor'])} ({d['valor_extenso']})"
        if d['forma_pagamento']:
            objeto += f", paga via {d['forma_pagamento']}"
    destino = f", destinada à campanha “{d['campanha']}”" if d['campanha'] else ''
    linhas = [
        f"RECIBO Nº {dados['numero_formatado']}",
        '',
        f"{nome_inst}{' — CNPJ ' + inst['cnpj_formatado'] if inst['cnpj_formatado'] else ''} declara que recebeu de "
        f"{quem} {objeto}{destino}, em {data}, a título de doação.",
        '',
        'Agradecemos a sua contribuição.',
    ]
    if inst['endereco'] or inst['email']:
        linhas += ['', ' · '.join(x for x in (inst['endereco'], inst['email'], inst['telefone']) if x)]
    return '\n'.join(linhas)


def enviar_por_email(recibo):
    """Envia o recibo ao e-mail do membro. Lança ReciboIndisponivel se não houver destinatário."""
    membro = recibo.doacao.apoiador
    if membro is None or not membro.email:
        raise ReciboIndisponivel('A doação não tem membro com e-mail para enviar o recibo.')
    dados = dados_recibo(recibo)
    texto = texto_recibo(dados)
    html = '<div style="font-family:Arial,sans-serif;max-width:600px">' + ''.join(
        f'<p>{escape(linha)}</p>' if linha else '' for linha in texto.split('\n')
    ) + '</div>'
    nome = dados['instituicao']['nome'] or 'Organização'
    mensagem = EmailMultiAlternatives(
        subject=f"Recibo de doação nº {dados['numero_formatado']} — {nome}",
        body=texto,
        to=[membro.email],
    )
    mensagem.attach_alternative(html, 'text/html')
    mensagem.send()
    Recibo.objects.filter(pk=recibo.pk).update(enviado_para=membro.email, enviado_em=timezone.now())
    recibo.refresh_from_db()
    return membro.email
