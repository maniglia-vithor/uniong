import os
import uuid

from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible

TAMANHO_MAXIMO = 5 * 1024 * 1024

TIPOS_PERMITIDOS = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
}


@deconstructible
class ArmazenamentoPrivado(FileSystemStorage):
    """Arquivos fora do MEDIA_ROOT, sem URL pública; o local é lido de PRIVATE_MEDIA_ROOT a cada uso."""

    def __init__(self):
        super().__init__(base_url=None)

    @property
    def base_location(self):
        return str(settings.PRIVATE_MEDIA_ROOT)

    @property
    def location(self):
        return os.path.abspath(self.base_location)

    def url(self, name):
        raise NotImplementedError('Anexos privados não têm URL pública.')


armazenamento_privado = ArmazenamentoPrivado()


def caminho_anexo(instance, filename):
    extensao = os.path.splitext(filename)[1].lower()
    return f'despesas/anexos/{uuid.uuid4().hex}{extensao}'


def _tipo_pela_assinatura(cabecalho):
    if cabecalho.startswith(b'%PDF-'):
        return 'application/pdf'
    if cabecalho.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if cabecalho.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if cabecalho[:4] == b'RIFF' and cabecalho[8:12] == b'WEBP':
        return 'image/webp'
    return None


def validar_anexo(arquivo):
    """Lança ValueError com mensagem em português se o arquivo não for aceito."""
    nome = arquivo.name or ''
    extensao = os.path.splitext(nome)[1].lower()
    if extensao not in TIPOS_PERMITIDOS:
        raise ValueError(f'“{nome}”: tipo não permitido. Envie PDF, JPG, PNG ou WEBP.')
    if arquivo.size > TAMANHO_MAXIMO:
        raise ValueError(f'“{nome}”: arquivo maior que 5 MB.')
    posicao = arquivo.tell()
    arquivo.seek(0)
    cabecalho = arquivo.read(12)
    arquivo.seek(posicao)
    if _tipo_pela_assinatura(cabecalho) != TIPOS_PERMITIDOS[extensao]:
        raise ValueError(f'“{nome}”: o conteúdo não corresponde à extensão do arquivo.')
