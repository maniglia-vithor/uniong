# Progresso das fases

Regras de trabalho e decisões de produto: ver `CLAUDE.md`. Resultado da verificação inicial: `docs/verificacao.md`.

## Como rodar os testes
```
venv\Scripts\python.exe manage.py test core
```
O usuário do MySQL configurado no `.env` consegue criar o banco de testes (`test_ong_db`), que é separado do banco de desenvolvimento e apagado ao final. Não foi necessário um `settings_test.py` com SQLite.

Frontend: `npm run build` e `npx oxlint` na pasta `ong_frontend/`.

## Fase 0 — Verificação e preparação ✅
Branch `fase-0-verificacao`.
- [x] Parte A: 16 pontos confirmados no código → `docs/verificacao.md`.
- [x] `check --deploy` (6 avisos), `npm run build` (ok) e `npx oxlint` (21 erros e 30 avisos já existentes) registrados.
- [x] `core/tests/` como pacote, fábricas em `core/tests/factories.py`.
- [x] Testes de caracterização: `percentual_progresso`, `status_efetivo()`, fábricas (11 testes passando).
- [x] CRC16 do BR Code: existe só no frontend (`utils/pix.js`), por isso não há teste no backend.

Decisões tomadas:
- `CLAUDE.md.md` renomeado para `CLAUDE.md` e versionado, para ser carregado automaticamente.
- `docs/prompts/` fica fora do Git (`.gitignore`), porque descreve falhas ainda abertas. A branch é enviada ao GitHub sem os prompts.

Pendências observadas (já existiam antes desta fase):
- O `npx oxlint` falha por `rules-of-hooks` em `pages/Configuracoes.jsx`. Como a regra 4 exige oxlint, a fase 1 deve resolver isso ao remover o seletor de perfil.

## Fase 1 — Segurança e autorização ✅
Branch `fase-1-seguranca`, criada a partir de `fase-0-verificacao` (a fase 0 ainda não foi integrada à `main` e a fase 1 depende do pacote `core/tests/`). 54 testes passando; `npx oxlint` com 0 erros (eram 21).
- [x] 1. Login com Google (crítico): `verify_oauth2_token` + `email_verified`; só staff ativo por `email__iexact`; nunca cria usuário; 503 sem `GOOGLE_CLIENT_ID`; frontend com `<GoogleLogin>` enviando só `{ credential }`.
- [x] 2. Autorização por perfil: `IsAdminUser` como padrão; rotas públicas com `AllowAny` explícito; `auth/token/` recusa não staff; `GET /api/auth/me/`; `RoleContext`, seletor e faixa “Membro” removidos; `RotaProtegida` espera `/auth/me/`.
- [x] 3. Proteção da chave PIX: PUT só superusuário; validação por tipo (CPF/CNPJ com dígitos verificadores, e-mail, +55, UUID); modelo `LogAlteracao`; notificação à equipe com valores mascarados.
- [x] 4. Login tradicional: throttling por IP (10/min no login, 5/min na doação pública); `token_blacklist` + `BLACKLIST_AFTER_ROTATION`; `POST /api/auth/logout/`; access de 60 min.
- [x] 5. Anexos de despesas: PDF/JPG/PNG/WEBP até 5 MB com checagem de assinatura; nome UUID em `PRIVATE_MEDIA_ROOT`; download autenticado com `attachment` + `nosniff`; `/media` não é mais servido.
- [x] 6. Configuração para produção: `DEBUG` padrão False; variáveis obrigatórias em produção; cabeçalhos HTTPS configuráveis; `.env.example` documentado; `popular_dados` com `--confirmar` e bloqueado fora de DEBUG.

Migrações: `0011_alter_notificacao_tipo_logalteracao` (novo modelo e choices `despesa`/`config`), `0012_alter_despesaanexo_arquivo` (storage privado), além das migrações do app `token_blacklist`. Nenhuma transforma dados (não havia anexos cadastrados).

Decisões tomadas:
- Botões “Editar” do `RecordDetailDrawer` foram mantidos: todo usuário com acesso ao painel é staff e tem permissão de escrita.
- `auth/token/` com usuário não staff responde 401 “Conta sem acesso ao painel.”, mesmo status de credencial inválida.
- `GET /api/auth/me/` exige apenas autenticação (não staff); o frontend recusa a sessão se `is_staff` for falso.
- Staff comum vê a chave PIX em Configurações, mas os campos ficam bloqueados.
- Notificações automáticas vão só para staff ativo (antes, sem staff, iam para todos os usuários).
- O log de alteração guarda os valores completos; só a notificação mascara.
- HSTS com `includeSubDomains` ligado e `preload` desligado: o `check --deploy` de produção mostra apenas `security.W021`, aceito de propósito.
- `NUM_PROXIES=0` por padrão: o limite por IP usa `REMOTE_ADDR` e ignora `X-Forwarded-For`, que pode ser forjado. Atrás de um proxy reverso, ajustar para 1.
- A rota de refresh não tem limite próprio (ela só aceita refresh válido).

Recomendações registradas (não feitas nesta fase):
- Migrar os tokens do `localStorage` para cookies `httpOnly` com `SameSite`, reduzindo o impacto de um eventual XSS.
- Em produção com vários processos, configurar um cache compartilhado (Redis ou banco) para o throttling funcionar entre processos; hoje usa `LocMemCache` (por processo).

Atenção:
- O usuário `joaovithoroliveira6@gmail.com` (criado pelo login Google antigo) não é staff, então não entra mais. Para liberar, marque-o como staff (ver resumo da fase).
- Os 30 avisos restantes do oxlint são anteriores; 7 vêm de `pages/CommunityPanel.jsx`, sem uso (limpeza prevista na fase 3, item 7).

## Fase 2 — Integridade dos dados financeiros e indicadores
- [ ] 1. Criação de campanha (erro 500)
- [ ] 2. Valor arrecadado calculado
- [ ] 3. Validações de cadastro
- [ ] 4. Paginação e listas completas
- [ ] 5. Datas, fuso e indicadores
- [ ] 6. Relatórios CSV

## Fase 3 — Doação pública, despesas recorrentes, configurações e limpeza
- [ ] 1. Doação pelo portal público
- [ ] 2. Fila de doações pendentes
- [ ] 3. Despesas recorrentes
- [ ] 4. Notificações
- [ ] 5. Configurações
- [ ] 6. Privacidade no portal
- [ ] 7. Limpeza e coerência

## Fase 4 — Transparência e prestação de contas
- [ ] 1. Despesas ligadas a campanhas
- [ ] 2. Saldo e histórico
- [ ] 3. Comprovantes públicos
- [ ] 4. Relatórios
- [ ] 5. Trilha de auditoria
- [ ] 6. Página pública por campanha

## Fase 5 — Funcionalidades essenciais que faltam
- [ ] 1. Equipe (usuários do painel)
- [ ] 2. Recuperação de senha
- [ ] 3. Doações mais realistas
- [ ] 4. Recibos
- [ ] 5. Dados da instituição
- [ ] 6. Comunicados para membros
- [ ] 7. LGPD
- [ ] 8. Módulo de voluntários (escopo original do artigo)

## Fase 6 — Implantação, qualidade e acessibilidade
- [ ] 1. Implantação
- [ ] 2. Backup
- [ ] 3. Integração contínua
- [ ] 4. Testes do frontend
- [ ] 5. Acessibilidade e responsividade (RNF01 do artigo)
- [ ] 6. README

## Fase 7 — Alinhar o artigo do TCC com o sistema
- [ ] `docs/revisao_artigo.md` com a tabela “Trecho do artigo → Situação no sistema → Texto sugerido”
