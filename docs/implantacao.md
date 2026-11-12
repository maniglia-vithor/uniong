# Implantação do UniONG

Este guia coloca o sistema no ar em um servidor Linux (VPS) com Docker. São três containers:

| Serviço | O que faz |
|---|---|
| `db` | MySQL 8.4, com os dados em um volume (`dados_mysql`) |
| `backend` | Django + gunicorn na porta interna 8000. Na subida aplica as migrações e roda o `collectstatic` |
| `web` | nginx com o build do React. Encaminha `/api/`, `/c/` e `/admin-django/` ao backend e serve `/static/` |

Os arquivos enviados ficam em volumes: `midia` (logo da instituição e imagens de campanha) e `privado` (anexos de despesas e comprovantes de doação, nunca servidos diretamente). Os backups vão para a pasta `./backups` do servidor.

> Os arquivos `Dockerfile`, `ong_frontend/Dockerfile`, `ong_frontend/nginx.conf` e `docker-compose.yml` foram escritos e revisados, mas não executados na máquina de desenvolvimento (sem Docker instalado). Na primeira subida, acompanhe `docker compose logs -f`.

## 1. Servidor

Qualquer VPS com 1 GB de RAM e Ubuntu 22.04 ou 24.04 atende uma ONG pequena (DigitalOcean, Hetzner, Contabo, Oracle Cloud Free Tier, Magalu Cloud...). Serviços gratuitos que rodam containers (Render, Railway, Fly.io) também servem, mas costumam exigir banco gerenciado e disco persistente pago para os anexos. Por isso a VPS é o caminho recomendado.

No servidor:

```bash
# Docker e plugin compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # saia e entre de novo na sessão

# Código
git clone https://github.com/maniglia-vithor/uniong.git
cd uniong
cp .env.example .env
nano .env                       # preencha conforme a seção 2
```

Aponte o domínio (registro DNS do tipo A) para o IP do servidor antes de configurar o HTTPS.

## 2. Variáveis de ambiente (`.env`)

O `.env` fica só no servidor e nunca vai para o Git. Com `DEBUG=False`, o Django se recusa a subir sem as variáveis marcadas como obrigatórias.

| Variável | Obrigatória | Exemplo / observação |
|---|---|---|
| `DEBUG` | — | `False` em produção |
| `SECRET_KEY` | sim | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `ALLOWED_HOSTS` | sim | `ong.exemplo.org` (o primeiro valor também é usado pelo healthcheck do container) |
| `CORS_ALLOWED_ORIGINS` | sim | `https://ong.exemplo.org` |
| `CSRF_TRUSTED_ORIGINS` | sim, para o admin do Django | `https://ong.exemplo.org` |
| `FRONTEND_URL` | sim | `https://ong.exemplo.org` (links dos e-mails e das prévias `/c/<id>/`) |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | sim | `DB_USER` **não pode ser `root`** no Docker: o container do MySQL cria esse usuário |
| `DB_ROOT_PASSWORD` | sim (compose) | senha do root do MySQL, usada só pelo container do banco |
| `DB_HOST`, `DB_PORT` | — | definidos pelo `docker-compose.yml` (`db:3306`) |
| `GOOGLE_CLIENT_ID` | não | vazio desativa o botão do Google (seção 5) |
| `EMAIL_BACKEND` e `EMAIL_*` | para e-mails reais | seção 6 |
| `DEFAULT_FROM_EMAIL` | — | `Instituto Exemplo <nao-responda@exemplo.org>` |
| `JWT_ACCESS_MINUTOS`, `THROTTLE_AUTH`, `THROTTLE_DOACAO_PUBLICA` | — | padrões: 60, `10/min`, `5/min` |
| `NUM_PROXIES` | — | padrão do compose: `1` (o nginx). Use `2` se houver outro proxy na frente (Caddy) |
| `USAR_PROXY_HTTPS` | — | `True` quando o HTTPS termina no proxy (seção 3) |
| `SECURE_SSL_REDIRECT`, `SECURE_HSTS_*` | — | ver seção 3 |
| `COMUNICADOS_LOTE`, `COMUNICADOS_LIMITE_SINCRONO` | — | padrões 50 e 300 |
| `BACKUP_MANTER` | — | quantos backups manter (padrão 7) |
| `PORTA_HTTP` | — | porta publicada pelo nginx (padrão 80; use 8080 se o Caddy ocupar a 80) |

## 3. HTTPS

O nginx do container `web` fala HTTP na porta 80. O jeito mais simples de ter HTTPS com certificado gratuito (Let's Encrypt) e renovação automática é o **Caddy** na frente:

```bash
sudo apt install -y caddy
```

Em `/etc/caddy/Caddyfile`:

```
ong.exemplo.org {
    reverse_proxy 127.0.0.1:8080
}
```

No `.env`: `PORTA_HTTP=8080`, `USAR_PROXY_HTTPS=True` e `NUM_PROXIES=2`. Depois, `sudo systemctl reload caddy`. O Caddy envia `X-Forwarded-Proto: https`; o nginx repassa esse cabeçalho e o Django reconhece a conexão como segura (`SECURE_PROXY_SSL_HEADER`).

- `SECURE_SSL_REDIRECT=True` é o padrão. Para um teste rápido só com HTTP (sem domínio), use `False` temporariamente.
- Deixe `SECURE_HSTS_PRELOAD=False`. Inscrever o domínio na lista de pré-carregamento é difícil de desfazer.

## 4. Subir, criar o primeiro superusuário e conferir

```bash
docker compose up -d --build
docker compose ps                       # backend deve ficar "healthy"
docker compose exec backend python manage.py createsuperuser
curl -s https://ong.exemplo.org/api/health/   # {"status": "ok"}
```

Entre em `https://ong.exemplo.org/login` com o superusuário. Em **Configurações → Instituição**, cadastre nome, CNPJ, logo e contatos. Em **Privacidade & Dados**, cadastre a chave PIX. As demais pessoas da equipe entram por convite, na tela **Equipe**.

O admin do Django fica em `/admin-django/` (para suporte técnico). A rota `/admin` é do painel React.

Para atualizar o sistema:

```bash
git pull
docker compose up -d --build            # as migrações rodam sozinhas na subida do backend
```

## 5. Login com Google (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto. Em **APIs e serviços → Tela de consentimento OAuth**, configure como "Externo".
2. Em **Credenciais → Criar credenciais → ID do cliente OAuth**, escolha o tipo **Aplicativo da Web**.
3. Em **Origens JavaScript autorizadas**, informe `https://ong.exemplo.org` (e `http://localhost:5173` para desenvolvimento).
4. Copie o ID do cliente para `GOOGLE_CLIENT_ID` no `.env` e rode `docker compose up -d --build` (o ID entra no build do frontend).

Só entra com o Google quem já tem usuário **ativo e da equipe** com o mesmo e-mail. Nenhuma conta é criada automaticamente.

## 6. E-mail (SMTP)

O sistema envia e-mails para:
- convites da equipe;
- recuperação de senha;
- recibos de doação;
- comunicados aos membros.

Sem configuração, o backend usa `django.core.mail.backends.console.EmailBackend`, que só imprime as mensagens no log.

Exemplo com um provedor SMTP (Brevo, Mailgun, Amazon SES, Zoho, ou o SMTP do Gmail com senha de app):

```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp-relay.brevo.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=usuario-do-provedor
EMAIL_HOST_PASSWORD=senha-ou-chave-smtp
DEFAULT_FROM_EMAIL=Instituto Exemplo <nao-responda@exemplo.org>
```

Configure SPF e DKIM do domínio conforme o provedor, para os e-mails não caírem no spam. Teste com:

```bash
docker compose exec backend python manage.py sendtestemail voce@exemplo.org
```

Comunicados com mais de `COMUNICADOS_LIMITE_SINCRONO` destinatários não são enviados pela tela. Envie-os pelo terminal:

```bash
docker compose exec backend python manage.py enviar_comunicado <id-do-comunicado>
```

## 7. Tarefas agendadas (cron)

No servidor, `crontab -e`:

```cron
# Doações pendentes das contribuições periódicas (idempotente; pode rodar todo dia)
0 6 * * * cd /home/usuario/uniong && docker compose exec -T backend python manage.py gerar_contribuicoes >> backups/cron.log 2>&1

# Backup diário às 2h (mantém os BACKUP_MANTER mais recentes em ./backups)
0 2 * * * cd /home/usuario/uniong && docker compose exec -T backend python manage.py backup >> backups/cron.log 2>&1
```

Sem Docker, use o Python do ambiente virtual: `cd /caminho && venv/bin/python manage.py backup`.

## 8. Backup e restauração

`python manage.py backup [--destino PASTA] [--manter N]` gera `uniong_backup_AAAA-MM-DD_HHMMSS.tar.gz` com:
- `banco.sql`: dump completo do MySQL (`mysqldump --single-transaction`);
- `media/`: logo e imagens de campanha;
- `privado/`: anexos de despesas e comprovantes.

O comando apaga os arquivos mais antigos além de `N`. **Copie os backups para fora do servidor** (outro disco, nuvem, `rclone`), porque um backup no mesmo disco não protege contra a perda do servidor. Os arquivos contêm dados pessoais: guarde-os com acesso restrito.

Para restaurar, por exemplo no mesmo servidor depois de um problema:

```bash
cd /home/usuario/uniong
mkdir /tmp/restauracao && tar -xzf backups/uniong_backup_2026-11-12_020000.tar.gz -C /tmp/restauracao

# 1. Banco (substitui o conteúdo atual!)
docker compose exec -T db sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' < /tmp/restauracao/banco.sql

# 2. Arquivos
docker compose cp /tmp/restauracao/media/. backend:/app/media/
docker compose cp /tmp/restauracao/privado/. backend:/app/privado/
docker compose exec -u root backend chown -R app:app /app/media /app/privado

docker compose restart backend
rm -rf /tmp/restauracao
```

Sem Docker: `mysql -u USUARIO -p ong_db < banco.sql` e copie `media/` e `privado/` para `MEDIA_ROOT` e `PRIVATE_MEDIA_ROOT`.

Teste a restauração de vez em quando em outra máquina: backup que nunca foi restaurado não é garantia.

## 9. Monitoramento

`GET /api/health/` responde `200 {"status": "ok"}` sem login e sem dados. Se o banco não responde, devolve `503`. Pode ser usado por serviços gratuitos de monitoramento (UptimeRobot, Better Stack) e já é usado pelo healthcheck do container `backend`.

Logs: `docker compose logs -f backend` (requisições do gunicorn e erros) e `docker compose logs -f web` (nginx).
