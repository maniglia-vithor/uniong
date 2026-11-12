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

## Fase 2 — Integridade dos dados financeiros e indicadores ✅
Branch `fase-2-dados-financeiros` (a partir de `fase-1-seguranca`). 105 testes passando; oxlint 0 erros, 24 avisos.
- [x] 1. Criação de campanha: `meta` → `meta_valor`; `ATOMIC_REQUESTS=True`.
- [x] 2. Valor arrecadado calculado: campo removido (migração 0013); `Campanha.objects.com_arrecadado()`; `percentual_progresso` real + `meta_atingida`.
- [x] 3. Validações: meta/valor > 0, `data_fim >= data_inicio`, doação em campanha encerrada, e-mail normalizado, celular com 10/11 dígitos, `Doacao.campanha` PROTECT (migração 0014), botão “Encerrar campanha”.
- [x] 4. Paginação: `PaginacaoPadrao` (20, até 500), busca e ordenação no servidor, filtros de período, `opcoes/`, `doacoes/resumo/`, componente de paginação nas 5 telas.
- [x] 5. Datas e indicadores: `core/indicadores.py`, `timezone.localdate()`, gastos do mês por `data_pagamento`, “A pagar no mês”, sem status `atrasado` gravado (migração 0015), tendências com `null` sem base.
- [x] 6. CSV: `;`, BOM, decimal com vírgula, neutralização de fórmulas, celular, filtros de período e status.

Relatório “valor gravado × valor real” antes da migração 0013 (banco de desenvolvimento):

| Campanha | Gravado | Soma real | Diferença |
|---|---|---|---|
| Alimentação Solidária | 18150.00 | 18150.00 | 0.00 |
| Escola para Todos | 30973.77 | 30973.77 | 0.00 |
| Saúde na Comunidade | 18500.00 | 18500.00 | 0.00 |
| Natal das Crianças | 17700.00 | 17700.00 | 0.00 |

Decisões tomadas:
- Migração 0014 normaliza e-mail/celular dos membros existentes (nenhum precisou de ajuste; nenhuma duplicata).
- Migração 0015: as 2 despesas pagas sem `data_pagamento` receberam a data de vencimento (melhor estimativa), para continuarem aparecendo nos gastos.
- Doação existente de campanha já encerrada pode ser editada (ex.: confirmar uma pendente); só é proibido criar/mover para campanha encerrada.
- Exclusão de membro com doações também responde 400 com mensagem (antes dava erro 500 por `ProtectedError`).
- Tendência de membros/campanhas: sem histórico de status, compara a mesma regra (status atual e data de cadastro/início até cada data). Limitação documentada em `core/indicadores.py`.
- Total arrecadado: tendência = acréscimo do mês sobre o total até o fim do mês anterior.
- Filtro de status na tela de Membros (RF05) já foi feito neste item 4 (ativo/inativo); a opção “interessado” entra na fase 3.
- Relatórios passaram a usar axios (com renovação de token) em vez de `fetch`.

## Fase 3 — Doação pública, despesas recorrentes, configurações e limpeza ✅
Branch `fase-3-coerencia` (a partir de `fase-2-dados-financeiros`). 146 testes passando; oxlint 0 erros, 12 avisos.
- [x] 1. Doação pública: status `interessado`, `origem` e `consentimento_em` (migração 0016), e-mail existente não altera dados, só campanha ativa, R$ 1 a R$ 100.000, honeypot, notificação, PIX com valor e txid `DOA{id}`, página `/privacidade`.
- [x] 2. Fila de pendentes: abas com contador, ações por linha e em lote (`POST /api/doacoes/acao-em-lote/`), contador no menu.
- [x] 3. Recorrência por âncora: `serie_id`, `data_ancora`, `numero_ocorrencia`, `recorrencia_fim` (migração 0017), geração só ao pagar, encerrar série, aplicar valor às próximas, status `cancelado`.
- [x] 4. Notificações: tipo `configuracao` (migração 0018), detalhe de despesa no painel lateral, sem requisição a `undefined`.
- [x] 5. Configurações: `PATCH /auth/me/`, `POST /auth/alterar-senha/`, `ConfiguracaoInstituicao.portal_ativo` (migração 0019) com portal indisponível, preferências sem efeito removidas.
- [x] 6. Privacidade no portal: sem `doacoes_recentes`, `descricao_publica` (migração 0020), RH agregado.
- [x] 7. Limpeza: páginas sem uso removidas, admin completo, QR Code local (`qrcode.react`), avisos de pureza corrigidos, aviso em Comunicação, filtro de status em Membros.

Migração das séries de despesas existentes (0017): agrupa despesas fixas por descrição + periodicidade; a mais antiga é a âncora e as demais entram na série só quando o vencimento coincide exatamente com uma ocorrência prevista. No banco de desenvolvimento não havia despesas fixas, então nada foi convertido.

Decisões tomadas:
- Dependência nova `qrcode.react@4.2.0`: o QR Code era gerado por `api.qrserver.com`, que recebia o código PIX.
- O tipo de notificação foi renomeado de `config` para `configuracao` (como pede o prompt); a coluna passou de 10 para 12 caracteres e a migração converte os registros.
- Doação pública com honeypot preenchido responde 201 com `id: null`, sem gravar.
- `encerrar-serie` usa como fim, por padrão, o vencimento da ocorrência atual; aceita `recorrencia_fim` explícito.
- `aplicar-valor-proximas` copia o valor salvo (não o digitado e não salvo) para as pendentes seguintes; a tela avisa para salvar antes.
- Restrição única `serie_id + numero_ocorrencia` sem condição: o MySQL não suporta restrição condicional, e `NULL` não conflita.
- Despesa no painel lateral é somente leitura, com atalho para Custos (a edição completa, com anexos, fica na tela de Custos).
- Configuração da instituição grava `LogAlteracao`, como a chave PIX.
- Página `/privacidade` é texto-base marcado para revisão da ONG.
- Sugestão registrada: captcha (hCaptcha/Turnstile) na doação pública, se o honeypot + throttling não bastarem.

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
