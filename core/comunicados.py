"""Envio de comunicados "Somente Membros" por e-mail, com link de descadastro por membro.

O envio é síncrono, em lotes de COMUNICADOS_LOTE mensagens por conexão SMTP, até
COMUNICADOS_LIMITE_SINCRONO destinatários por requisição. Acima disso, a tela orienta a usar
`python manage.py enviar_comunicado <id>`, que envia para todos sem limite (pode ser agendado).
"""
from django.conf import settings
from django.core import signing
from django.core.mail import EmailMessage, get_connection
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Apoiador, Comunicado, ConfiguracaoInstituicao
from .throttles import AuthThrottle

SAL_DESCADASTRO = 'core.comunicados.descadastro'


class EnvioIndisponivel(Exception):
    pass


def token_descadastro(apoiador):
    return signing.dumps(apoiador.pk, salt=SAL_DESCADASTRO)


def apoiador_do_token(token):
    try:
        pk = signing.loads(token, salt=SAL_DESCADASTRO)
    except signing.BadSignature:
        return None
    return Apoiador.objects.filter(pk=pk).first()


def destinatarios():
    return Apoiador.objects.filter(status='ativo', recebe_comunicados=True).exclude(email='').order_by('id')


def _mensagem(comunicado, apoiador, nome_instituicao, conexao):
    link = f"{settings.FRONTEND_URL.rstrip('/')}/descadastrar/{token_descadastro(apoiador)}"
    corpo = (
        f'Olá, {apoiador.nome}!\n\n{comunicado.conteudo}\n\n'
        f'— {nome_instituicao}\n\n'
        f'Você recebe este e-mail por ser membro de {nome_instituicao}. '
        f'Para não receber mais comunicados, acesse: {link}'
    )
    return EmailMessage(
        subject=f'[{nome_instituicao}] {comunicado.titulo}'[:200],
        body=corpo,
        to=[apoiador.email],
        headers={'List-Unsubscribe': f'<{link}>'},
        connection=conexao,
    )


def enviar(comunicado, limite=None):
    """Envia o comunicado aos membros ativos que aceitam e-mails. Devolve quantos foram enviados."""
    if comunicado.publico_alvo != 'apoiadores':
        raise EnvioIndisponivel('Só comunicados "Somente Membros" são enviados por e-mail.')
    if comunicado.enviado_em:
        raise EnvioIndisponivel('Este comunicado já foi enviado por e-mail.')
    pessoas = list(destinatarios())
    if not pessoas:
        raise EnvioIndisponivel('Nenhum membro ativo aceita receber comunicados por e-mail.')
    if limite is not None and len(pessoas) > limite:
        raise EnvioIndisponivel(
            f'São {len(pessoas)} destinatários, acima do limite de {limite} para envio pela tela. '
            f'Peça ao responsável técnico para rodar: python manage.py enviar_comunicado {comunicado.pk}'
        )
    nome = ConfiguracaoInstituicao.obter().nome or 'Organização'
    lote = settings.COMUNICADOS_LOTE
    enviados = 0
    for inicio in range(0, len(pessoas), lote):
        with get_connection() as conexao:
            mensagens = [_mensagem(comunicado, p, nome, conexao) for p in pessoas[inicio:inicio + lote]]
            enviados += conexao.send_messages(mensagens) or 0
    Comunicado.objects.filter(pk=comunicado.pk).update(emails_enviados=enviados, enviado_em=timezone.now())
    comunicado.refresh_from_db()
    return enviados


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def descadastrar(request, token):
    """GET mostra para quem é o link; POST confirma o descadastro (evita que leitores de e-mail descadastrem sozinhos)."""
    apoiador = apoiador_do_token(token)
    if apoiador is None:
        return Response({'erro': 'Link de descadastro inválido.'}, status=400)
    if request.method == 'POST' and apoiador.recebe_comunicados:
        apoiador.recebe_comunicados = False
        apoiador.save(update_fields=['recebe_comunicados'])
    primeiro_nome = apoiador.nome.split(' ')[0]
    return Response({'nome': primeiro_nome, 'recebe_comunicados': apoiador.recebe_comunicados})
