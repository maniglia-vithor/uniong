# UniONG: gestão para ONGs de pequeno porte

[![CI](https://github.com/maniglia-vithor/uniong/actions/workflows/ci.yml/badge.svg)](https://github.com/maniglia-vithor/uniong/actions/workflows/ci.yml)

O UniONG é uma aplicação web de gestão para Organizações Não Governamentais de pequeno porte. Foi desenvolvido como Trabalho de Conclusão de Curso na Fatec São Bernardo do Campo “Adib Moisés Dib”.

O sistema reúne, num painel administrativo:
- membros;
- campanhas;
- doações;
- despesas;
- comunicados;
- voluntários.

Também oferece um portal público de transparência, com prestação de contas, doação via PIX e páginas de campanha para compartilhar.

---

## Funcionalidades

**Painel administrativo** (só para a equipe: usuários `is_staff` ativos)
- **Painel**: indicadores do mês com tendência, saldo, receitas × despesas dos últimos 12 meses, voluntários ativos e horas de voluntariado.
- **Campanhas**: meta, valor arrecadado calculado a partir das doações confirmadas, gasto e saldo por campanha, imagem pública, encerramento. Campanhas com doações não podem ser excluídas.
- **Doações**:
  - confirmação em lote;
  - doações anônimas;
  - forma de pagamento, observação e comprovante privado;
  - doações em bens, fora dos totais financeiros;
  - contribuições periódicas (mensalidades);
  - recibo com número sequencial e valor por extenso, para imprimir ou enviar por e-mail.
- **Membros**:
  - cadastro com CPF/CNPJ validado;
  - contribuições;
  - preferência de comunicados;
  - exportação dos dados do titular e anonimização (LGPD).
- **Custos**:
  - despesas por categoria e vinculadas a campanhas;
  - despesas recorrentes em série;
  - anexos privados;
  - comprovantes que podem ser publicados no portal.
- **Comunicação**: comunicados públicos (no portal) ou só para membros, com envio por e-mail e link de descadastro.
- **Voluntários**: cadastro, atividades com limite de vagas, inscrições e registro de horas.
- **Relatórios**: CSV (separador `;`, padrão do Excel em português) de doações, campanhas, membros e despesas. Prestação de contas por período em página imprimível.
- **Equipe**: convite por e-mail, papéis de administrador geral e operador, desativação de acesso.
- **Histórico**: trilha de auditoria de criação, edição e exclusão, com valores antes e depois.
- **Configurações**: tema claro/escuro, perfil e senha, dados da instituição (nome, CNPJ, logo, contatos), chave PIX e ligar/desligar o portal.

**Portal público** (`/transparencia`)
- totais, campanhas em andamento, gastos do mês e prestação de contas anual;
- doação com QR Code PIX "copia e cola" gerado no navegador;
- página e link de compartilhamento por campanha (`/c/<id>/`), com prévia nas redes sociais;
- nenhum dado pessoal de doadores é exibido.

**Segurança e qualidade**
- JWT com renovação, rotação e revogação no logout;
- login com Google só para usuários já cadastrados;
- limite de tentativas por IP;
- recuperação de senha por e-mail;
- validação dos arquivos enviados;
- configurações de produção obrigatórias;
- interface com WCAG AA nos dois temas: nota 100 de acessibilidade no Lighthouse nas telas principais.

## Arquitetura

```
Navegador ──► nginx (container "web")
                ├── /            React (build do Vite)
                ├── /api/  /c/  /admin-django/  ──► Django + DRF (gunicorn) ──► MySQL
                └── /static/     arquivos do collectstatic
```

| Camada | Tecnologias |
|---|---|
| Backend | Python 3.12, Django 5.2, Django REST Framework, SimpleJWT, python-decouple |
| Banco | MySQL 8 (SQLite nos testes automatizados) |
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4, axios, Recharts, qrcode.react |
| Testes | `django.test` (backend), Vitest + Testing Library (frontend), oxlint |
| Implantação | Docker, docker-compose, nginx, gunicorn, GitHub Actions |

Organização do código:

```
core/                  app Django único: modelos, API, regras de negócio
  indicadores.py       cálculos do painel, do portal e da prestação de contas
  relatorios.py        CSV e prestação de contas
  equipe.py, recibos.py, comunicados.py, voluntarios.py, lgpd.py ...
  management/commands/ backup, gerar_contribuicoes, enviar_comunicado, popular_dados
  tests/               testes automatizados do backend
ong_backend/           settings.py (produção/desenvolvimento) e settings_test.py (CI)
ong_frontend/src/
  pages/  components/  hooks/  services/api.js  utils/
docs/                  progresso por fase, verificação e guia de implantação
```

Na interface, “Membro” é o termo usado para quem a API chama de `Apoiador` (`/api/apoiadores/`).

## Como rodar localmente

Pré-requisitos: Python 3.12 ou superior, Node.js 22 ou superior e MySQL 8.

```bash
git clone https://github.com/maniglia-vithor/uniong.git
cd uniong

# Banco
mysql -u root -p -e "CREATE DATABASE ong_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Backend
python -m venv venv
venv\Scripts\activate            # Windows (PowerShell). No Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
copy .env.example .env           # Linux/macOS: cp .env.example .env. Depois preencha DB_PASSWORD e confira DEBUG=True
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver       # http://localhost:8000

# Frontend (outro terminal)
cd ong_frontend
npm install
npm run dev                      # http://localhost:5173
```

> No PowerShell, se a ativação do `venv` for bloqueada, rode uma vez:
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

| Endereço | O que é |
|---|---|
| `http://localhost:5173/transparencia` | Portal público |
| `http://localhost:5173/login` | Login do painel |
| `http://localhost:5173/admin` | Painel administrativo |
| `http://localhost:8000/api/health/` | Healthcheck |
| `http://localhost:8000/admin-django/` | Admin do Django (suporte técnico) |

Em desenvolvimento, os e-mails do sistema (convites, recuperação de senha, recibos, comunicados) aparecem no terminal do `runserver`. Para o login com Google, defina `GOOGLE_CLIENT_ID` no `.env` e `VITE_GOOGLE_CLIENT_ID` em `ong_frontend/.env.local`.

Dados de exemplo: `python manage.py popular_dados --confirmar`. O comando só roda com `DEBUG=True`, **apaga os dados existentes** e não deve ser usado num banco com dados reais.

## Testes

```bash
# Backend: no MySQL local (cria e apaga o banco test_ong_db)
python manage.py test core

# Backend: em SQLite, sem MySQL (é o que o CI usa)
python manage.py test --settings=ong_backend.settings_test

# Frontend
cd ong_frontend
npx oxlint
npm test          # Vitest + Testing Library
npm run build
```

O GitHub Actions (`.github/workflows/ci.yml`) roda tudo isso a cada push e pull request.

## Implantação

Resumo (o passo a passo completo está em [docs/implantacao.md](docs/implantacao.md)):

```bash
cp .env.example .env    # DEBUG=False, SECRET_KEY, ALLOWED_HOSTS, CORS/CSRF, FRONTEND_URL, DB_*, DB_ROOT_PASSWORD, EMAIL_*
docker compose up -d --build
docker compose exec backend python manage.py createsuperuser
```

O guia cobre:
- HTTPS com Caddy;
- configuração do Google OAuth e do SMTP;
- tarefas agendadas no cron: `gerar_contribuicoes` e `backup`;
- backup e restauração;
- monitoramento por `GET /api/health/`.

## Variáveis de ambiente

Todas estão documentadas em [.env.example](.env.example). Com `DEBUG=False`, o Django só inicia com as obrigatórias definidas.

| Grupo | Variáveis |
|---|---|
| Geral | `DEBUG`, `SECRET_KEY`*, `ALLOWED_HOSTS`*, `CORS_ALLOWED_ORIGINS`*, `CSRF_TRUSTED_ORIGINS`, `FRONTEND_URL` |
| Banco | `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_ROOT_PASSWORD` (Docker) |
| Login | `GOOGLE_CLIENT_ID`, `JWT_ACCESS_MINUTOS`, `THROTTLE_AUTH`, `THROTTLE_DOACAO_PUBLICA`, `NUM_PROXIES` |
| E-mail | `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`, `PASSWORD_RESET_TIMEOUT`, `COMUNICADOS_LOTE`, `COMUNICADOS_LIMITE_SINCRONO` |
| Arquivos e backup | `PRIVATE_MEDIA_ROOT`, `STATIC_ROOT`, `BACKUP_DIR`, `BACKUP_MANTER` |
| HTTPS | `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`, `SECURE_HSTS_INCLUDE_SUBDOMAINS`, `SECURE_HSTS_PRELOAD`, `USAR_PROXY_HTTPS` |
| Docker | `PORTA_HTTP` |

\* obrigatórias em produção.

## Autores

Trabalho de Conclusão de Curso da Fatec São Bernardo do Campo “Adib Moisés Dib”: *Aplicação voltada à gestão de ONGs de pequeno porte*.

- Bruno Radiuk Goes
- Emily Caroline Rodrigues Fonseca
- Guilherme Silva Rodrigues Lima
- João Vithor de Oliveira Maniglia

Orientador: Prof. Ms. Claudemir Martins da Silva.
