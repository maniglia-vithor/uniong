# Fase 0 — Verificação dos pontos no código

Base: branch `fase-0-verificacao`, criada a partir da `main` no commit `7593aa7`. Data: 11/11/2026.
Método: leitura do código e, quando indicado, reprodução contra o banco de desenvolvimento (MySQL) em transações desfeitas ao final. Nenhum dado foi alterado.

## Parte A — Resultado

| # | Ponto | Resultado | Evidência |
|---|---|---|---|
| 1 | `valor_arrecadado` gravável pelo serializer; frontend envia o campo | **Confirmado** (só a 1ª parte) | `core/serializers.py:27-35`: `fields` explícito inclui `valor_arrecadado`, sem `read_only_fields`; só `percentual_progresso` é read-only (`:28`). O frontend **não** envia o campo: `pages/Campanhas.jsx:11` e `:63-70`, `components/RecordDetailDrawer.jsx:148-155` e `:162` montam o payload sem ele. Como o campo tem `default=0` no modelo, o serializer o trata como opcional e um PUT sem ele não altera o valor. Qualquer cliente da API, porém, pode gravar um valor arbitrário. |
| 2 | Atualização da campanha com soma em memória ou `F()`; `transaction.atomic` | **Confirmado** (em memória, sem transação) | `core/models.py:106-134`: `campanha.valor_arrecadado += self.valor` / `-= old_valor` (`:126`, `:130`, `:133`) e `campanha.save()` (`:134`). Não há `F()` nem `transaction.atomic` no arquivo. Também não há tratamento de exclusão nem de troca de campanha (reproduzido na revisão anterior). |
| 3 | “Hoje”/“início do mês” | **Confirmado**: só `date.today()` | `core/models.py:178` (`status_efetivo`); `core/views.py:143` (dashboard/resumo), `:214` (grafico-mensal), `:314` (kpi-doacoes-mes), `:434` (despesas/resumo), `:470` (despesas/por-categoria), `:601` (painel_transparencia), `:720` (data da doação pública); `core/management/commands/popular_dados.py:62`. Nenhum uso de `timezone.localdate()`/`timezone.now()`. Em Linux/macOS o Django aplica `TIME_ZONE` ao processo (`time.tzset`), então `date.today()` coincide com o horário de Brasília; no Windows (ambiente atual) usa o fuso do sistema operacional. |
| 4 | `?status=atrasado` em despesas; `atrasado` gravado | **Diferente do descrito** | `core/views.py:379` filtra pelo campo gravado. Pendentes vencidas **não** aparecem em `?status=atrasado`, porque `status_efetivo()` (`core/models.py:174-179`) só calcula o valor. O status `atrasado` **pode** ser gravado, mas apenas se o usuário escolher manualmente no formulário (`pages/Custos.jsx:373`); o sistema nunca o grava sozinho. |
| 5 | Valor “anterior” nas tendências de Membros e Campanhas Ativas | **Confirmado** (não é histórico) | `core/views.py:178-180`: membros com `status='ativo'` (status **atual**) e `data_cadastro < início do mês`. `:184-186`: campanhas com `status='ativa'` (atual) e `data_inicio < início do mês`. Quem ficou inativo neste mês sai também do “anterior”; não há registro histórico de status. |
| 6 | Validação de anexos; `/media/` com autenticação; proxy do Vite | **Confirmado** | Sem validação de extensão, MIME ou tamanho: `core/models.py:224` (`FileField` simples) e `core/views.py:384-389`. `/media/` é servido por `static()` (`ong_backend/urls.py:12`), sem autenticação e só com DEBUG. O Vite faz proxy apenas de `/api` (`ong_frontend/vite.config.js:8-9`). A URL do anexo é absoluta (`core/serializers.py:64`) e usa o Host da requisição; atrás do proxy fica `http://localhost:5173/media/...` (simulado), e `GET http://localhost:5173/media/...` devolve `text/html` (a página do React). **Os links de anexo não funcionam em desenvolvimento.** Não há anexos cadastrados hoje. |
| 7 | `token_blacklist`; logout invalida refresh | **Confirmado** (não instalado; não invalida) | `ong_backend/settings.py:13-24` não inclui `rest_framework_simplejwt.token_blacklist`. O logout (`ong_frontend/src/context/AuthContext.jsx:25-30`) só apaga o localStorage; o refresh token continua válido por 7 dias. |
| 8 | Throttling | **Confirmado** (nenhum) | Nenhuma ocorrência de `throttl` em `ong_backend/` ou `core/`; `REST_FRAMEWORK` não define `DEFAULT_THROTTLE_*`. |
| 9 | Recorrência de despesas | **Confirmado**, com ressalvas | `core/models.py:182-190`: mensal e anual com `relativedelta` (`:185`, `:190`), semanal com `timedelta` (`:188`), sempre sobre o vencimento da ocorrência atual, o que acumula desvio (31/01 → 28/02 → 28/03). A ocorrência criada é `is_fixed=True` (`:212`), com a mesma periodicidade. `data_pagamento` **não** é preenchida ao marcar como paga (`core/views.py:411-420`); só se o usuário digitar. A geração ocorre na criação (`:397-398`) e na transição para pago (`:418-420`). |
| 10 | Validações nos serializers | **Confirmado** (nenhuma existe) | `core/serializers.py`: o único `validate_*` é `validate_chave` (PIX, `:11`). Não há meta > 0, valor > 0, `data_fim >= data_inicio`. Doação pública aceita campanha de qualquer status (`core/views.py:707`, `Campanha.objects.get(pk=...)` sem filtro). E-mail sem normalização (`core/views.py:688` faz só `strip()`; `get_or_create` em `:696`); `Apoiador.email` é `unique` (`core/models.py:12`), e a colação padrão do MySQL torna a comparação insensível a maiúsculas no banco, mas nada normaliza o valor gravado. Os mínimos existem só no HTML dos formulários (`min="0.01"`, `min="1"`). |
| 11 | Nome, logo e dados da instituição fixos | **Confirmado** | Nome “UniONG” e logo importada como asset: `pages/Login.jsx:7`, `:93-94`, `:105`, `:134-136`, `:270`; `components/Layout.jsx:12`, `:147-153`; `pages/Transparencia.jsx:18`, `:232`, `:485`, `:661`. Valores padrão do PIX `UNIONG` / `SAO PAULO` em `utils/pix.js:37-38`. Título da aba: `ong_frontend/index.html:7` = “ong_frontend”. `pages/CommunityPanel.jsx:50`, `:223` (“ONG Gestão”) está sem uso. Só a chave PIX, o nome do recebedor e a cidade são configuráveis. |
| 12 | Filtro por status na tela de Membros | **Confirmado**: só na API | API: `core/views.py:44-49` (`?status`). Tela: `pages/Apoiadores.jsx:80` chama `getApoiadores()` sem parâmetros (`services/api.js:53`); não há controle de filtro, só ordenação por coluna. |
| 13 | txid do BR Code na doação geral | **Diferente do descrito** | Não existe QR Code para doação geral: o modal “Realizar doação” (`pages/Transparencia.jsx:87`) não gera PIX. O QR só existe por campanha, com `txid` `CAMPANHA{id}` (`:214`), alfanumérico, até 25 caracteres enquanto o id tiver até 17 dígitos. Se chamado sem txid, `utils/pix.js:29-30` usa `***` e corta em 25. |
| 14 | Login tradicional: username ou e-mail | **Confirmado**: `username` | `ong_backend/urls.py:9` (`TokenObtainPairView` padrão, campo `username`); `pages/Login.jsx:12`, `:57`, `:161`. Usuários: `admin` (e-mail `admin@ong.org`, staff, ativo; username **≠** e-mail) e `joaovithoroliveira6@gmail.com` (criado pelo login Google, não staff, ativo; username = e-mail). |
| 15 | CSV | **Confirmado** (`csv.writer`, delimitador vírgula) | `core/views.py:494-498` (BOM UTF-8), `:505`, `:523`, `:543`: `csv.writer` com delimitador padrão `,`. Decimais convertidos para vírgula (`:512`, `:529-530`, `:557`), por isso o `csv.writer` coloca esses valores entre aspas. O Excel em pt-BR espera `;` e, ao abrir com duplo clique, tende a juntar as colunas. |
| 16 | Rotas que respondem a anônimos | **Confirmado** (varredura de todas as rotas) | GET anônimo em todas as rotas: 31 exigem login (401). Anônimas: `/api/auth/token/` e `/api/auth/token/refresh/` (`ong_backend/urls.py:9-10`); `/api/auth/google/` (`core/views.py:563`); `/api/public/transparencia/` (`:598`); `/api/public/doacoes/` (`:684`); `/admin/` (redireciona para a tela de login do Django); `/media/*` (servido sem autenticação com DEBUG). As variantes sem barra final só redirecionam (301) para a versão com barra, que exige login. |

## Resultado dos verificadores

### `python manage.py check --deploy`
6 avisos, 0 erros (com o `.env` de desenvolvimento):
- `security.W004`: `SECURE_HSTS_SECONDS` não definido.
- `security.W008`: `SECURE_SSL_REDIRECT` não é `True`.
- `security.W009`: `SECRET_KEY` fraca ou com prefixo `django-insecure-`.
- `security.W012`: `SESSION_COOKIE_SECURE` não é `True`.
- `security.W016`: `CSRF_COOKIE_SECURE` não é `True`.
- `security.W018`: `DEBUG=True`.

### `npm run build`
Conclui com sucesso. Único aviso: bundle acima de 500 kB após minificação (sugestão de divisão de código).

### `npx oxlint`
**Falha (código de saída 1): 21 erros e 30 avisos.**
- Erros (21): todos `react-hooks(rules-of-hooks)` em `pages/Configuracoes.jsx`. Os `useState`/`useEffect` vêm depois de `if (!isAdmin) return ...`.
- Avisos (30): `react(set-state-in-effect)` (9), `eslint(no-unused-vars)` (7), `react(purity)` por `new Date()` na renderização (6), `react-hooks(exhaustive-deps)` (5, por exemplo `pages/Custos.jsx:190` e `components/RecordDetailDrawer.jsx:310`), `react(only-export-components)` (3).

A regra 4 do CLAUDE.md exige oxlint ao fim de cada item. Ele já falha hoje, antes de qualquer mudança. Os erros de `Configuracoes.jsx` desaparecem quando o seletor de perfil e a verificação `isAdmin` forem refeitos (decisão “Acesso ao painel”, fase 1).

## CRC16 do BR Code
O gerador PIX existe apenas no frontend (`ong_frontend/src/utils/pix.js`); não há versão em Python, então não há teste de caracterização no backend. Na revisão anterior, o CRC foi conferido manualmente com o exemplo do manual do Banco Central (resultado `1D3D`, igual ao esperado).

## Problemas novos encontrados (não corrigidos)
1. **Links de anexos de despesa quebrados em desenvolvimento** (item 6): a URL aponta para o host do frontend, que não encaminha `/media`. Além disso, os arquivos são públicos para quem tiver a URL.
2. **`valor_arrecadado` pode ser sobrescrito pela API** (item 1): qualquer usuário autenticado pode enviar `valor_arrecadado` num PUT/PATCH de campanha.
3. **Recorrência mensal acumula desvio de dia** (item 9): uma despesa com vencimento no dia 31 passa a vencer no dia 28 a partir de fevereiro.
4. **`date.today()` depende do sistema operacional** (item 3): em Linux segue o `TIME_ZONE` do Django; em Windows segue o fuso da máquina. Se um servidor Windows estiver em UTC, entre 21h e 0h (Brasília) o “hoje” já é o dia seguinte, afetando “Doações do Mês”, gastos do mês e o status “atrasado”. `timezone.localdate()` elimina a dependência. Risco baixo.
5. **CSV com vírgula decimal e delimitador vírgula** (item 15): abre desalinhado no Excel em pt-BR.
6. **`oxlint` falhando** antes de qualquer alteração (ver acima).
7. Menor: `core/urls.py:21` tem duas chamadas `path(...)` na mesma linha (resto da remoção das reações). Funciona, mas dificulta a leitura.
