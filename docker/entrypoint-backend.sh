#!/bin/sh
# Aplica as migrações e publica os arquivos estáticos antes de iniciar o servidor.
# Cada etapa escreve uma linha no log, para mostrar onde o início parou.
set -e
echo "inicio: aplicando migrações..."
python manage.py migrate --noinput
echo "inicio: migrações ok; publicando arquivos estáticos..."
# Os estáticos só servem ao admin do Django: uma falha aqui não impede o sistema de subir.
if ! python manage.py collectstatic --noinput; then
  echo "inicio: AVISO: collectstatic falhou; o admin do Django ficará sem estilo."
fi
echo "inicio: iniciando o servidor: $*"
exec "$@"
