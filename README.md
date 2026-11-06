# UniONG — Portal Unificado para Pequenas ONGs

---

## Sobre o Projeto

O **UniONG** é um sistema de gestão administrativa desenvolvido para pequenas Organizações Não Governamentais (ONGs). O objetivo é centralizar e facilitar as operações do dia a dia, oferecendo transparência financeira e controle eficiente dos recursos.

### Funcionalidades principais

- **Painel Principal (Dashboard)** — KPIs em tempo real com tendências mensais, gráfico de arrecadação dos últimos 12 meses e rankings de apoiadores
- **Campanhas** — Cadastro e acompanhamento de campanhas de arrecadação com barra de progresso
- **Doações** — Registro completo de doações com vínculo a apoiadores e campanhas
- **Apoiadores** — Gestão do cadastro de apoiadores e histórico de contribuições
- **Comunicação** — Comunicados internos e externos com controle de público-alvo
- **Custos** — Gestão de despesas por categoria com gráfico de distribuição e alertas de inadimplência
- **Relatórios** — Exportação de dados em CSV para Doações, Campanhas e Apoiadores
- **Portal de Transparência** — Página pública com dados anonimizados da organização
- **Login com Google** — Autenticação via conta Google OAuth 2.0

### Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Python 3 + Django 5 + Django REST Framework |
| Banco de dados | MySQL |
| Frontend | React 18 + Vite + Tailwind CSS |
| Gráficos | Recharts |
| Autenticação | JWT (SimpleJWT) + Google OAuth 2.0 |

---

## Pré-requisitos

Antes de começar, certifique-se de ter instalado em sua máquina:

| Ferramenta | Versão recomendada | Download |
|---|---|---|
| **Python** | 3.11 ou superior | https://www.python.org/downloads/ |
| **Node.js** | 18 ou superior (inclui npm) | https://nodejs.org/ |
| **MySQL Server** | 8.0 ou superior | https://dev.mysql.com/downloads/mysql/ |
| **Git** | qualquer versão recente | https://git-scm.com/downloads |

> **Dica:** Para verificar se já estão instalados, abra o terminal e execute:
> ```
> python --version
> node --version
> npm --version
> mysql --version
> git --version
> ```

---

## Passo a Passo

### 1. Clonando o Repositório

Abra o terminal (PowerShell no Windows ou Bash no Linux/macOS), navegue até a pasta onde deseja salvar o projeto e execute:

```bash
git clone https://github.com/maniglia-vithor/uniong.git
cd uniong
```

---

### 2. Configuração do Banco de Dados

#### Via MySQL Workbench

1. Abra o **MySQL Workbench**
2. Conecte-se ao seu servidor local
3. No painel de consultas (Query), execute:

```sql
CREATE DATABASE ong_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

4. Clique no botão **Execute** (ícone de raio ⚡) ou pressione `Ctrl+Enter`

#### Via linha de comando (CLI)

```bash
mysql -u root -p
```

Após digitar sua senha, execute:

```sql
CREATE DATABASE ong_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

---

### 3. Configuração do Backend (Django)

#### 3.1 Criar e ativar o ambiente virtual Python

O ambiente virtual isola as dependências do projeto para não conflitar com outros projetos Python na sua máquina.

**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

> Se aparecer um erro de política de execução no PowerShell, execute primeiro:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```
> Depois tente ativar novamente.

**Linux / macOS (Bash):**
```bash
python3 -m venv venv
source venv/bin/activate
```

Após ativar, o início do terminal deve exibir `(venv)` indicando que o ambiente está ativo.

#### 3.2 Instalar as dependências Python

Com o ambiente virtual ativo, instale todas as bibliotecas necessárias:

```bash
pip install -r requirements.txt
```

#### 3.3 Configurar as variáveis de ambiente

Duplique o arquivo de exemplo e renomeie-o:

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

Abra o arquivo `.env` em qualquer editor de texto e preencha os campos:

```env
# Chave secreta do Django — gere uma em: https://djecrety.ir/
SECRET_KEY=coloque-uma-chave-secreta-longa-e-aleatoria-aqui

# Deixe True em desenvolvimento, False em produção
DEBUG=True

ALLOWED_HOSTS=localhost,127.0.0.1

# Credenciais do seu MySQL local
DB_NAME=ong_db
DB_USER=root
DB_PASSWORD=sua-senha-do-mysql-aqui
DB_HOST=localhost
DB_PORT=3306

CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Google OAuth (opcional para desenvolvimento inicial)
# Obtenha em: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=SEU_CLIENT_ID_AQUI.apps.googleusercontent.com
```

> **Importante:** O arquivo `.env` **nunca** deve ser enviado ao repositório. Ele já está listado no `.gitignore`.

#### 3.4 Aplicar a estrutura do banco de dados

Este comando cria todas as tabelas necessárias no MySQL automaticamente:

```bash
python manage.py migrate
```

A saída esperada é uma lista de operações com `OK` ao lado de cada uma.

#### 3.5 Criar o usuário administrador

Para acessar o painel, você precisa de um usuário. Execute:

```bash
python manage.py createsuperuser
```

O sistema pedirá:
- **Username:** escolha um nome de usuário (ex: `admin`)
- **Email:** seu e-mail (pode deixar em branco)
- **Password:** uma senha (mínimo 8 caracteres)

#### 3.6 Iniciar o servidor backend

```bash
python manage.py runserver
```

O backend estará disponível em: **http://localhost:8000**

Você pode verificar a API em: http://localhost:8000/api/

> Mantenha este terminal aberto enquanto usa o sistema.

---

### 4. Configuração do Frontend (React)

Abra um **novo terminal** (mantenha o backend rodando no terminal anterior).

#### 4.1 Navegar para a pasta do frontend

```bash
cd ong_frontend
```

#### 4.2 Instalar as dependências Node.js

```bash
npm install
```

Este comando pode demorar alguns minutos na primeira execução. Ele baixa todas as bibliotecas listadas no `package.json`.

#### 4.3 Configurar as variáveis de ambiente do frontend

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**
```bash
cp .env.example .env
```

O arquivo `.env` do frontend contém o Client ID do Google OAuth. Para desenvolvimento inicial, pode ser deixado em branco — o login com Google simplesmente não funcionará, mas o login tradicional continuará funcionando.

#### 4.4 Iniciar o servidor frontend

```bash
npm run dev
```

O frontend estará disponível em: **http://localhost:5173**

---

## Acessando o Sistema

Com os dois servidores rodando, acesse **http://localhost:5173** no navegador.

| URL | Descrição |
|---|---|
| `http://localhost:5173` | Portal de Transparência (público) |
| `http://localhost:5173/login` | Tela de login |
| `http://localhost:5173/admin` | Painel Administrativo (requer login) |
| `http://localhost:8000/api/` | API REST do backend |
| `http://localhost:8000/admin/` | Admin nativo do Django |

Use o usuário criado no passo **3.5** para fazer o primeiro login.

---

## Estrutura de Pastas

```
uniong/
├── core/                   # App principal do Django
│   ├── migrations/         # Histórico de migrações do banco
│   ├── models.py           # Modelos (Apoiador, Campanha, Doação, Despesa...)
│   ├── serializers.py      # Serializers do DRF
│   ├── views.py            # ViewSets e endpoints da API
│   └── urls.py             # Rotas da API
├── ong_backend/            # Configurações globais do Django
│   └── settings.py
├── ong_frontend/           # Aplicação React
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── pages/          # Páginas (Dashboard, Campanhas, Doações...)
│   │   ├── services/       # Funções de chamada à API (api.js)
│   │   └── context/        # Contexto de autenticação
│   └── package.json
├── venv/                   # Ambiente virtual Python (não commitar)
├── manage.py               # CLI do Django
├── requirements.txt        # Dependências Python
├── .env.example            # Modelo de variáveis de ambiente
└── .gitignore
```

---

## Solução de Problemas Comuns

**`ModuleNotFoundError` ao rodar o Django**
→ Certifique-se de que o ambiente virtual está ativo (`(venv)` no início do terminal) e rode `pip install -r requirements.txt` novamente.

**Erro de conexão com o banco de dados**
→ Verifique se o MySQL Server está rodando e se as credenciais no `.env` estão corretas (usuário, senha e nome do banco).

**`CORS` bloqueando requisições do frontend**
→ Confirme que `CORS_ALLOWED_ORIGINS` no `.env` contém `http://localhost:5173`.

**Porta 8000 ou 5173 já em uso**
→ Backend: `python manage.py runserver 8001` · Frontend: `npm run dev -- --port 5174`

**`Set-ExecutionPolicy` necessário no PowerShell**
→ Execute o comando de política de execução indicado na seção 3.1 e tente novamente.
