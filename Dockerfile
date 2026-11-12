# Backend (Django + gunicorn). Usado pelo docker-compose.yml; veja docs/implantacao.md.
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# mysqlclient precisa compilar; o cliente do MySQL traz o mysqldump usado pelo comando backup.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config default-libmysqlclient-dev default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY manage.py ./
COPY ong_backend ong_backend
COPY core core
COPY docker/entrypoint-backend.sh /entrypoint.sh
COPY docker/healthcheck.py /healthcheck.py

RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/staticfiles /app/media /app/privado /app/backups \
    && chown -R app:app /app \
    && chmod +x /entrypoint.sh
USER app

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["python", "/healthcheck.py"]

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "ong_backend.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60", "--access-logfile", "-"]
