"""Configurações para rodar os testes sem MySQL (CI): python manage.py test --settings=ong_backend.settings_test"""
from .settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'test_ci.sqlite3',  # noqa: F405
        'ATOMIC_REQUESTS': True,
        'TEST': {'NAME': ':memory:'},
    }
}
# Hash de senha rápido: os testes criam muitos usuários.
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
