#!/bin/sh
# Aplica as migrações e publica os arquivos estáticos antes de iniciar o gunicorn.
set -e
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec "$@"
