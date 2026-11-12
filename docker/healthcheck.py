"""Healthcheck do container backend.

Em produção o Django só aceita os domínios de ALLOWED_HOSTS e redireciona HTTP para HTTPS; por isso a
requisição interna usa o primeiro domínio permitido e se apresenta como já vinda por HTTPS (como o proxy faz).
"""
import os
import sys
import urllib.request

host = os.environ.get('ALLOWED_HOSTS', 'localhost').split(',')[0].strip().lstrip('.') or 'localhost'
requisicao = urllib.request.Request(
    'http://127.0.0.1:8000/api/health/',
    headers={'Host': host, 'X-Forwarded-Proto': 'https'},
)
try:
    with urllib.request.urlopen(requisicao, timeout=4) as resposta:
        sys.exit(0 if resposta.status == 200 else 1)
except Exception:
    sys.exit(1)
