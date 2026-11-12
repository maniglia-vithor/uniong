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

## Fase 4 — Transparência e prestação de contas ✅
Branch `fase-4-transparencia` (a partir de `fase-3-coerencia`). 180 testes passando; oxlint 0 erros, 12 avisos.
- [x] 1. Despesas ligadas a campanhas: `Despesa.campanha` PROTECT (migração 0021); arrecadado, gasto e saldo por campanha (subconsultas, sem somas duplicadas); `GET /campanhas/{id}/despesas/`.
- [x] 2. Saldo e histórico: funções de período em `core/indicadores.py`, card “Saldo do Mês”, gráfico receitas × despesas com saldo acumulado, seção pública “Prestação de contas” por ano.
- [x] 3. Comprovantes públicos: `DespesaAnexo.publico` (migração 0022), rota pública só para anexos públicos de despesas pagas (nunca RH), ícone no portal.
- [x] 4. Relatórios: CSV de despesas; prestação de contas por período em HTML imprimível.
- [x] 5. Auditoria: `LogAlteracao.acao` (migração 0023), `AuditoriaMixin` nos 4 ViewSets, `GET /api/historico/` e tela “Histórico” (só superusuário), aba no painel lateral.
- [x] 6. Página pública por campanha: `/transparencia/campanha/:id`, `/c/<id>/` com Open Graph, imagem validada, status efetivo pela data de fim, aviso único de meta atingida (migração 0024).

Telas novas (descrição):
- Painel: 5º card “Saldo do Mês” (receitas − despesas pagas) e gráfico “Receitas × despesas (últimos 12 meses)” com barras agrupadas, linha de saldo acumulado e botão “Ver como tabela”.
- Portal: seção “Prestação de contas” com seletor de ano, três totais (recebido, gasto, saldo), pizza de gasto por categoria e evolução mensal; lista de gastos com ícone “Comprovante”.
- Portal: página da campanha com imagem de capa, selo de status, progresso, arrecadado/meta/gasto/saldo, QR Code PIX (ou aviso de encerrada), botões de compartilhamento e tabela de despesas da campanha.
- Painel: menu “Histórico” (superusuário) com filtros por registro, ação, período e busca; tabela com usuário, campo, antes e depois. Aba “Histórico” no painel lateral de cada registro.
- Relatórios: card “Prestação de contas” (período + formato) que abre uma página branca imprimível; card de CSV de despesas com categoria.
- Custos: seleção de campanha e caixa “Público no portal” nos anexos. Campanhas: campo de imagem.

Decisões tomadas:
- PDF: `reportlab` não era dependência; a prestação de contas é uma página HTML com CSS de impressão (`window.print()`), que o navegador salva em PDF.
- A soma de doações e despesas por campanha usa subconsultas; com `JOIN` duplo os valores seriam multiplicados.
- Campanhas pausadas não têm página pública; encerradas têm (sem QR Code de doação).
- Comprovantes de Recursos Humanos nunca são públicos (mesmo marcados), coerente com a agregação da fase 3.
- Imagem de campanha é servida por uma rota da API (`/api/public/campanhas/{id}/imagem/`), já que `/media` deixou de ser servido na fase 1.
- O registro de auditoria fica em `create/update/destroy` (não em `perform_*`), porque os ViewSets já personalizam `perform_*`. A próxima ocorrência de despesa gerada automaticamente não gera log de criação (é ação do sistema).
- O aviso de meta atingida é disparado na confirmação de doação (cadastro, edição e ação em lote).
- `FRONTEND_URL` (novo, `.env`) define para onde `/c/<id>/` redireciona. O Vite faz proxy de `/c/`; reiniciar o `npm run dev` para valer.

Teste manual sugerido: cadastrar uma despesa paga ligada a uma campanha com anexo marcado como público; abrir o portal, a campanha e o link `/c/<id>/`; gerar a prestação de contas do ano em Relatórios e imprimir; editar uma doação e conferir a aba Histórico.

## Fase 5 — Funcionalidades essenciais que faltam ✅
Branch `fase-5-funcionalidades` (a partir de `fase-4-transparencia`). 238 testes passando; oxlint 0 erros, 12 avisos (os mesmos da fase 4).
- [x] 1. Equipe: tela “Equipe” (só superusuário) com convite por e-mail (link de 72 h, token próprio), reenviar convite, desativar/reativar, administrador geral × operador; bloqueia ficar sem administrador geral ativo. `EMAIL_*` no `.env`.
- [x] 2. Recuperação de senha: `/api/auth/recuperar-senha/` (sempre 200, mesmo texto, com limite por IP) e `/api/auth/redefinir-senha/`; páginas `/recuperar-senha` e `/redefinir-senha/:uid/:token`; link no login.
- [x] 3. Doações: anônimas (`apoiador` opcional), `forma_pagamento` (padrão pix), `observacao`, comprovante privado, tipo financeira | bens (bens com valor 0, fora de todos os totais, indicador e coluna próprios), `Contribuicao` + `gerar_contribuicoes` (migração 0025).
- [x] 4. Recibos: modelo `Recibo` (número = id, sequencial, reemissão mantém o número), `Apoiador.documento` com validação de CPF/CNPJ, valor por extenso, página imprimível e envio por e-mail (migração 0027).
- [x] 5. Dados da instituição: nome, CNPJ, descrição, logo, contatos e redes (migração 0026); aba “Instituição” em Configurações; usados no menu, portal, prestação de contas, recibos e `og:site_name`.
- [x] 6. Comunicados por e-mail aos membros ativos, em lotes, com registro de quantidade/data e link de descadastro (`recebe_comunicados`, migração 0028); comando `enviar_comunicado` acima do limite.
- [x] 7. LGPD: anonimizar membro (superusuário, com confirmação) e exportar dados em JSON (migração 0029).
- [x] 8. Voluntários: `Voluntario`, `Atividade`, `InscricaoAtividade` com vagas e horas (migração 0030); tela, dois indicadores no painel e total de horas no portal.

Telas novas (descrição):
- Menu “Equipe” (superusuário): tabela com nome, e-mail, papel, situação (Ativo / Convite pendente / Desativado, com texto além da cor) e último acesso; botões de convite, reenviar, desativar/reativar e trocar papel.
- Páginas públicas simples (cartão branco no centro): “Defina sua senha”, “Recuperar senha”, “Nova senha” e “Comunicados por e-mail” (descadastro com botão de confirmação).
- Doações: formulário com “Doação anônima”, tipo (financeira ou bens), forma de pagamento, observação e comprovante; coluna de valor mostra a forma de pagamento ou “Bens (≈ R$ …)”; cabeçalho mostra o total em bens; botão “Gerar recibo”/“Ver recibo” nas confirmadas.
- Recibo: página branca imprimível com logo e dados da instituição, número, texto com valor por extenso, linha de assinatura e botão “Enviar para <e-mail>”.
- Ficha do membro (painel lateral): seção “Contribuições periódicas” (lista, pausar/reativar, nova) e “Dados pessoais (LGPD)” com “Exportar dados (JSON)” e “Anonimizar membro”.
- Configurações: aba “Instituição” (superusuário) com logo e campos de contato.
- Comunicação: caixa “Enviar por e-mail aos membros ativos (N destinatários)” e botão “Enviar por e-mail” nos cards; o card mostra quando e para quantos foi enviado.
- Menu “Voluntários”: abas Voluntários (cadastro e horas totais) e Atividades (vagas, inscritos, horas; modal “Inscrições e horas”). Painel: cards “Voluntários Ativos” e “Horas de Voluntariado no Mês”. Portal: frase com o total de horas.

Decisões tomadas:
- Usuário convidado é criado inativo e sem senha utilizável; o `username` é o e-mail. O token do convite usa sal próprio (não serve como redefinição de senha) e fica inválido quando a senha é definida. Redefinição: 2 h (`PASSWORD_RESET_TIMEOUT`).
- Recuperação de senha só envia e-mail para membros ativos da equipe (`is_staff`); a resposta é idêntica para qualquer e-mail.
- `EMAIL_BACKEND` padrão é o console (as mensagens aparecem no terminal do `runserver`); em produção, SMTP pelo `.env`.
- Doação em bens grava `valor = 0` e o valor estimado em campo próprio: assim nenhuma soma financeira muda, mesmo em consultas antigas. A migração 0025 dá `forma_pagamento = pix` a todas as doações existentes (padrão do campo); as do portal também ficam pix.
- Contribuições: a doação gerada fica pendente, com data no dia de vencimento do mês de competência; a restrição única (contribuição, competência) garante a idempotência. Agendar `python manage.py gerar_contribuicoes` diariamente no cron (exemplo no `--help`).
- Recibo só para doação confirmada; doação com recibo não pode ser excluída (PROTECT; o caminho é cancelar). Número exibido como `AAAA/000123` (ano da emissão + id).
- Logo da instituição fica no `MEDIA_ROOT` e é servido por rota da API (`/api/public/instituicao/logo/`), como a imagem de campanha. Sem nome cadastrado, as telas mostram “Nossa organização” e a inicial no lugar do logo. O login continua com a marca UniONG (é a tela do sistema); o rodapé do portal diz “desenvolvido com UniONG”.
- Comunicados: envio síncrono em lotes de 50 (`COMUNICADOS_LOTE`) até 300 destinatários (`COMUNICADOS_LIMITE_SINCRONO`); acima disso a API recusa e indica o comando `enviar_comunicado <id>`. Um comunicado é enviado uma única vez. O link de descadastro é assinado (`django.core.signing`) e o descadastro só acontece com POST (leitores de e-mail que abrem links não descadastram ninguém).
- LGPD: a anonimização também apaga os valores antigos da trilha de auditoria do membro e troca o nome nas notificações; as doações permanecem ligadas ao registro anônimo. A exportação fica registrada no histórico.
- Voluntário com atividades não pode ser excluído (inative-o); excluir uma atividade apaga suas inscrições. O portal mostra apenas o total de horas, sem nomes.
- Uma execução da suíte de testes levou ~100 min uma única vez (travamento do ambiente/MySQL); repetida, roda em ~42 s.

Não feito / limitações:
- Recibo em PDF gerado no servidor: mantido HTML imprimível (decisão da fase 4); o e-mail leva o recibo em texto/HTML, sem anexo PDF.
- Fila assíncrona (Celery etc.) para e-mails: não adicionada para não incluir dependências; documentado o comando para listas grandes.

Teste manual sugerido: em Equipe, convidar um e-mail e copiar o link do terminal do `runserver` para definir a senha; usar “Esqueci minha senha” no login; cadastrar uma doação anônima, uma em bens e uma com comprovante; gerar e enviar um recibo; preencher a aba Instituição e conferir menu, portal e prestação de contas; criar um comunicado “Somente Membros” com envio por e-mail e abrir o link de descadastro; cadastrar uma contribuição na ficha de um membro e rodar `python manage.py gerar_contribuicoes`; cadastrar voluntários e uma atividade com 1 vaga, inscrever e registrar horas.

## Fase 6 — Implantação, qualidade e acessibilidade ✅
Branch `fase-6-implantacao` (a partir de `fase-5-funcionalidades`). Backend: 246 testes passando (MySQL e SQLite). Frontend: 18 testes Vitest; oxlint 0 erros, 12 avisos (os mesmos da fase 4). CI no GitHub Actions passando.
- [x] 1. Implantação: `Dockerfile` (gunicorn, migrações e `collectstatic` na subida, usuário sem privilégios, healthcheck), `ong_frontend/Dockerfile` + `nginx.conf` (proxy de `/api/`, `/c/`, `/admin-django/`; `/static/` por volume), `docker-compose.yml` (MySQL 8.4 + volumes). Admin do Django movido para `/admin-django/`. `GET /api/health/` anônimo, sem dados (503 se o banco cair). Guia em `docs/implantacao.md`.
- [x] 2. Backup: `python manage.py backup [--destino] [--manter N]` (mysqldump + `media/` + `privado/` em `.tar.gz` com data; mantém os N mais recentes). Restauração e cron no guia.
- [x] 3. CI: `.github/workflows/ci.yml` (check, `makemigrations --check`, testes com `ong_backend/settings_test.py` em SQLite; oxlint, Vitest e build). Badge no README.
- [x] 4. Testes do frontend: Vitest + Testing Library para `utils/pix.js` (CRC 1D3D do exemplo do Banco Central, valor, txid, nome/cidade sem acento e truncados), `formatBRL`/`formatData`, `Paginacao`, `RotaProtegida` e `Modal` (foco e Esc).
- [x] 5. Acessibilidade e responsividade (detalhes abaixo).
- [x] 6. README reescrito (visão geral, funcionalidades, arquitetura, execução local, testes, implantação, variáveis e autores).

Lighthouse, categoria Acessibilidade (desktop; build de produção servido por `vite preview` com um backend isolado em SQLite e dados fictícios, sem tocar o banco de desenvolvimento):

| Tela | Antes (claro / escuro) | Depois (claro / escuro) |
|---|---|---|
| Login | 90 / 90 | 100 / 100 |
| Painel | 90 / 90 | 100 / 100 |
| Doações | 95 / 95 | 100 / 100 |
| Transparência | 94 / 94 | 100 / 100 |

Falhas encontradas antes:
- botões sem nome (sino de notificações, mostrar senha);
- contraste de `--text-muted`, do menu lateral, das cores da marca usadas como texto e das tendências dos cartões;
- ausência de `<main>`;
- `lang="en"`;
- cabeçalho de tabela vazio;
- área de toque pequena no botão de senha.

Na primeira medição o tema escuro era sobrescrito pelo próprio app antes da auditoria. O script foi corrigido, passou a conferir o tema aplicado e o "antes" escuro foi medido de novo sobre o código anterior (`git stash`).

O que foi feito em acessibilidade:
- Modais (Modal, painel de detalhes, detalhes dos KPIs, modais do portal), pelo hook `useDialogo`:
  - `role="dialog"`, `aria-modal` e `aria-labelledby`;
  - foco inicial dentro do modal e Tab/Shift+Tab presos nele;
  - Esc fecha e o foco volta ao elemento que abriu.
- Formulários: `Campo` associa o `<label>` ao campo e liga a mensagem de erro por `aria-describedby`/`aria-invalid`; o mesmo vale no login e na aba Instituição.
- Botões só com ícone: todos ganharam `aria-label` (varredura automática dos `.jsx`). O botão de remover notificação estava dentro de outro botão; foi separado.
- Gráficos: o componente `GraficoAcessivel` dá título, descrição textual e "Ver como tabela" aos 5 gráficos que ainda não tinham; o gráfico de fluxo já tinha.
- Contraste WCAG AA nos dois temas:
  - novas variáveis `--marca-texto`, `--destaque-texto` e outras de cor de texto, com versão escura;
  - função `corDeTexto` para as cores dinâmicas;
  - selos e tendências em tons -700/-800.
  - Selos de status já trazem o texto, e as tendências trazem ícone e sinal: nada depende só da cor.
- Responsividade:
  - menu lateral recolhível abaixo de 768 px (botão "Abrir menu" com `aria-expanded`; fecha ao navegar ou tocar fora);
  - tabelas com rolagem horizontal própria, conferido em 375 px: a página não rola na horizontal, só a tabela;
  - painel de notificações limitado à largura da tela.
- Percentuais com vírgula decimal (antes "0.9%").

Decisões tomadas:
- Dependências novas:
  - `gunicorn` 23.0.0: servidor WSGI de produção;
  - `vitest`, `@testing-library/react`, `@testing-library/jest-dom` e `jsdom`: só desenvolvimento, pedidas pelo item 4.
  - Lighthouse e puppeteer foram usados só numa pasta temporária, fora do projeto.
- O HTTPS fica num proxy na frente do nginx (guia com Caddy + Let's Encrypt), em vez de certificados dentro do container. O healthcheck do container usa o primeiro `ALLOWED_HOSTS` e `X-Forwarded-Proto: https`, para não esbarrar no redirecionamento HTTPS de produção.
- O `.tar.gz` do backup só ganha o nome final quando está completo. A senha do MySQL vai por `MYSQL_PWD`, não pela linha de comando.
- `settings_test.py` usa SQLite em memória, hash de senha rápido e e-mail em memória. Os 246 testes passam nos dois bancos.
- `vite.config.js` aceita `VITE_PROXY_API`, usado para medir o Lighthouse contra o backend isolado.
- Corrigido em seguida: o `popular_dados` falharia com recibos e despesas ligadas a campanhas (PROTECT).

Não feito / limitações:
- **Docker não foi executado nesta máquina** (não está instalado). Os arquivos foram revisados e o `collectstatic` e o script de healthcheck foram testados fora do container. Na primeira subida, acompanhe `docker compose logs -f`.
- O backup foi testado de verdade contra o MySQL local (dump de 54 KB). O arquivo, que contém dados reais, foi apagado logo depois.
- O Lighthouse avalia regras automáticas. Navegação completa por teclado e leitor de tela em todas as telas não foi testada manualmente; o comportamento dos modais está coberto por teste automatizado.

Teste manual sugerido:
1. Abrir o painel no celular (ou com o DevTools em 375 px) e usar o menu.
2. Abrir "Registrar Doação" e navegar só com Tab/Shift+Tab e Esc.
3. Alternar o tema escuro e conferir a leitura.
4. Clicar em "Ver como tabela" nos gráficos.
5. Rodar `python manage.py backup --destino <pasta>` e abrir o `.tar.gz`.
6. Acessar `/api/health/`.

## Fase 7 — Alinhar o artigo do TCC com o sistema ✅
Branch `fase-7-artigo` (a partir de `fase-6-implantacao`). Nenhum código alterado.
- [x] `docs/revisao_artigo.md` com a tabela “Trecho do artigo → Situação no sistema → Texto sugerido”. Cobre os 14 pontos do prompt e tem cinco apêndices:
  - A: entidades e diagrama ER em Mermaid;
  - B: módulos ausentes no artigo;
  - C: seção “Resultados e validação” com roteiro e questionário SUS em português;
  - D: considerações finais e limitações;
  - E: requisitos RF11–RF17 e RNF06–RNF10.

Decisões tomadas:
- O prompt pede o código da `main`, mas as fases ainda não foram mescladas. A revisão usa a `fase-6-implantacao`, que contém todas as fases encadeadas; isso está registrado no topo do documento.
- O texto do artigo foi lido do `Artigo final.docx` (mesmo conteúdo do PDF).
- Números usados: 246 testes de backend, 18 de frontend e as notas do Lighthouse da fase 6.
- Deixados como `[preencher]`:
  - cobertura de código (não medida; o coverage.py não está instalado);
  - resultados do SUS, ainda não aplicado;
  - datas de acesso das referências novas;
  - eventual publicação em produção.
- Afirmações do artigo corrigidas:
  - o login tradicional é por nome de usuário, não por e-mail;
  - o endpoint do Google valida o *id_token*, não recebe e-mail e nome;
  - o valor arrecadado é calculado, não um campo atualizado;
  - não há geração antecipada de ocorrências futuras de despesas;
  - não existe mais a lista de “doações recentes anonimizadas” no portal;
  - a prestação de contas é HTML imprimível, não PDF gerado no servidor.

## Extra — Alternância de visão para a apresentação ✅
Branch `fase-8-visao-membro` (a partir de `fase-7-artigo`), a pedido do autor, para a demonstração na banca.
- [x] Controle “Administrador | Membro” no topo do painel. “Membro” abre o portal público (`/transparencia`), que é o que um membro vê. No portal, quem está logado vê o botão “Voltar à visão de administrador”.
- [x] Configurações → Instituição: bloco “Portal de transparência” com o endereço público (`<origem>/transparencia`) e os botões “Abrir portal” e “Copiar link”.
- [x] Painel: os cartões “Saldo do Mês”, “Voluntários Ativos” e “Horas de Voluntariado no Mês” abrem a lista detalhada, como os demais. Endpoints novos: `/api/dashboard/kpi-saldo-mes/` (doações confirmadas e despesas pagas do mês, com sinal), `kpi-voluntarios-ativos/` e `kpi-horas-voluntariado-mes/`, com testes.

Decisão: é só um atalho de navegação, sem papel simulado nem mudança de permissões. Por isso não reverte a decisão do CLAUDE.md que removeu o seletor simulado de perfil: membros continuam sem login, e o papel exibido continua vindo do backend.
