from datetime import timedelta
from pathlib import Path
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = config('DEBUG', default=False, cast=bool)


def _obrigatoria_em_producao(nome, valor_dev):
    """Em desenvolvimento usa o valor padrão; com DEBUG=False a variável precisa estar no .env."""
    valor = config(nome, default='')
    if valor:
        return valor
    if DEBUG:
        return valor_dev
    raise ImproperlyConfigured(f'Defina {nome} no .env: obrigatória com DEBUG=False.')


SECRET_KEY = _obrigatoria_em_producao('SECRET_KEY', 'django-insecure-chave-somente-para-desenvolvimento')

ALLOWED_HOSTS = Csv()(_obrigatoria_em_producao('ALLOWED_HOSTS', 'localhost,127.0.0.1'))

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ong_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ong_backend.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': config('DB_NAME', default='ong_db'),
        'USER': config('DB_USER', default='root'),
        'PASSWORD': config('DB_PASSWORD', default=''),
        'HOST': config('DB_HOST', default='localhost'),
        'PORT': config('DB_PORT', default='3306'),
        'OPTIONS': {
            'charset': 'utf8mb4',
        },
    }
}

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAdminUser',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_RATES': {
        'auth': config('THROTTLE_AUTH', default='10/min'),
        'doacao_publica': config('THROTTLE_DOACAO_PUBLICA', default='5/min'),
    },
    # Número de proxies reversos à frente do Django; 0 usa o REMOTE_ADDR e ignora X-Forwarded-For.
    'NUM_PROXIES': config('NUM_PROXIES', default=0, cast=int),
}

GOOGLE_CLIENT_ID = config('GOOGLE_CLIENT_ID', default='')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=config('JWT_ACCESS_MINUTOS', default=60, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

CORS_ALLOWED_ORIGINS = Csv()(
    _obrigatoria_em_producao('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000')
)

CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())

# Segurança HTTPS: ativa por padrão quando DEBUG=False, cada item ajustável pelo .env.
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
if not DEBUG:
    SECURE_SSL_REDIRECT = config('SECURE_SSL_REDIRECT', default=True, cast=bool)
    SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=True, cast=bool)
    CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=True, cast=bool)
    SECURE_HSTS_SECONDS = config('SECURE_HSTS_SECONDS', default=31536000, cast=int)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = config('SECURE_HSTS_INCLUDE_SUBDOMAINS', default=True, cast=bool)
    SECURE_HSTS_PRELOAD = config('SECURE_HSTS_PRELOAD', default=False, cast=bool)
    if config('USAR_PROXY_HTTPS', default=False, cast=bool):
        SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True

USE_TZ = True

STATIC_URL = 'static/'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Anexos de despesas: fora de MEDIA_ROOT, servidos só pela API autenticada.
PRIVATE_MEDIA_ROOT = config('PRIVATE_MEDIA_ROOT', default=str(BASE_DIR / 'privado'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}
