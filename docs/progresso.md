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

## Fase 1 — Segurança e autorização
- [ ] 1. Login com Google (crítico)
- [ ] 2. Autorização por perfil
- [ ] 3. Proteção da chave PIX
- [ ] 4. Login tradicional
- [ ] 5. Anexos de despesas
- [ ] 6. Configuração para produção

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
