# CLAUDE.md — UniONG

## O projeto
UniONG é um TCC da Fatec SBC: sistema web de gestão para ONGs de pequeno porte (membros, campanhas, doações, despesas, comunicados) com um portal público de transparência.

- Backend: Python, Django 5.2, Django REST Framework, simplejwt, MySQL. Projeto `ong_backend`, app único `core`.
- Frontend: React 19, Vite, React Router 7, Tailwind 4, axios, recharts. Pasta `ong_frontend/`.
- Na interface o termo “Membro” substitui “Apoiador”; no código/API continuam `Apoiador`/`apoiadores`. Não renomeie modelos nem rotas.
- Idioma de tudo que o usuário vê: português do Brasil. Datas dd/mm/aaaa, valores em R$.

## Regras de trabalho (valem para todas as fases)
1. Trabalhe numa branch própria por fase (`fase-N-descricao`), criada a partir da `main` atualizada.
2. Um commit por item corrigido, com mensagem em português no formato `fix(area): ...` ou `feat(area): ...`.
3. Antes de alterar, leia o código envolvido. Se um problema descrito no prompt não existir ou for diferente do descrito, **não invente correção**: registre em `docs/progresso.md` e siga.
4. Toda regra de negócio corrigida ou criada ganha teste automatizado em `core/tests/`. Rode `python manage.py test` e `npm run build` (e `npx oxlint` no frontend) ao final de cada item relevante. Não termine a fase com testes falhando.
5. Mudanças de modelo exigem migração. Se a migração transformar dados existentes, escreva uma migração de dados e explique no resumo.
6. Não apague dados do banco de desenvolvimento. Não rode `popular_dados` sem eu pedir.
7. Não adicione dependências sem necessidade; quando adicionar, inclua em `requirements.txt` ou `package.json` e justifique no resumo.
8. Mantenha `docs/progresso.md` atualizado: checklist da fase, o que foi feito, o que foi descartado e por quê, decisões tomadas.
9. Se surgir uma decisão de produto que não esteja em “Decisões já tomadas”, escolha a opção mais simples e segura, registre em `docs/progresso.md` e siga — não pare para perguntar, exceto se a mudança for destrutiva/irreversível.
10. Ao terminar a fase, entregue um resumo: itens feitos, itens não feitos, arquivos alterados, migrações criadas, como testar manualmente.

## Decisões já tomadas (edite se quiser outra coisa)
- **Acesso ao painel:** só usuários `is_staff` e ativos. O seletor simulado de perfil “Admin/Membro” é **removido**. O papel exibido vem do backend (`/api/auth/me/`). Membros continuam sendo cadastros, sem login.
- **Login Google:** só entra quem já tem usuário cadastrado e ativo com aquele e-mail. Nenhum usuário é criado automaticamente.
- **Valor arrecadado:** deixa de ser campo armazenado; passa a ser calculado por agregação das doações confirmadas.
- **Exclusão de campanha com doações:** bloqueada (`PROTECT`). O caminho é encerrar a campanha.
- **“Gastos do mês” (painel, Custos e portal):** despesas **pagas** no mês (por `data_pagamento`). “A pagar” é mostrado separadamente.
- **Membro criado pelo portal público:** status novo `interessado` (não conta em “Membros Ativos”) até um administrador confirmar a primeira doação.
- **Preferências sem efeito real** (densidade, idioma, notificações por tipo, liga/desliga do portal): removidas da tela, exceto as que a fase 3 implementar no backend.
- **Comunicados “Somente Membros”:** passam a ser enviados por e-mail aos membros ativos (fase 5). Até lá, a tela informa que não aparecem no portal.
