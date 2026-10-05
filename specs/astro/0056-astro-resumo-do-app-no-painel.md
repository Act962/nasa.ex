---
id: 0056
titulo: Astro abre o painel com um resumo do App aberto
dominio: astro
status: implementada
autor: Weydson
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: leve
---

# 0056 — Astro abre o painel com um resumo do App aberto

## 1. Contexto

O painel do Astro mostrava uma pergunta fixa por App ("Como posso ajudar com os formulários?") e sugestões que o usuário precisava tocar para descobrir o básico (quantas respostas chegaram, qual formulário trouxe mais leads).

## 2. Objetivo

Ao abrir o painel numa conversa vazia, o Astro já "manda" uma mensagem com o resumo da semana do App aberto, chamando o usuário pelo primeiro nome. As sugestões continuam abaixo.

Fora do escopo: gravar essa mensagem na conversa (ela é só a tela inicial), cobrar Stars (não usa IA) e Apps sem resumo definido (seguem com a pergunta fixa).

## 3. Requisitos

- **RF-1** Procedure `astro.appBriefing` (somente leitura, sem IA) recebe o App (lista em `src/features/astro/lib/astro-briefing-apps.ts`) e devolve `{ message: string | null }`.
- **RF-2** Formulários: conta respostas **enviadas** (`completedAt` preenchido) desde segunda-feira 00:00 nos formulários da organização ativa; o formulário com mais respostas ligadas a lead é o que "trouxe mais leads".
- **RF-3** Tracking: conta leads criados desde segunda-feira 00:00 nos trackings não arquivados **dos quais o usuário participa**; cita o tracking que mais recebeu.
- **RF-4** O painel mostra a mensagem no lugar da pergunta grande; enquanto carrega, mostra "digitando"; se vier `null` ou der erro, volta para a pergunta fixa.
- **RF-5** Formulários e Tracking ganham uma 4ª sugestão.
- **RF-6** Cada mensagem do Astro é precedida por "Astro está digitando…" (spinner, 2 s); depois do resumo vem "Quer saber algo mais <no App>?".
- **RF-7** A abertura fica no topo também depois que a conversa começa.
- **RF-8** Com o painel aberto, trocar de App (ou abrir num App diferente do último mostrado) acrescenta as sugestões e as mensagens do App novo no fim da conversa e desce até a caixa de texto. Apps sem resumo mandam a pergunta do App.
- **RF-9** Com o painel fechado, o resumo do App aberto aparece no balão de fala do orb (10 s), uma vez por visita ao App; tocar no balão abre a conversa.
- **RF-10** O resumo segue a mesma régua de acesso da tela do App: matriz de Permissões (`canView` da chave do App) e, no Financeiro/Contábil, a whitelist do PaymentAccess (`dashboard.view`). Sem acesso, nenhum número é consultado: o Astro avisa "você não tem acesso aos dados do <App>" e diz como pedir liberação; as sugestões somem.

## 4. Critérios de aceite

- **CA-1** Com 5 respostas na semana e o formulário "Orçamento" com mais leads: "Fulano, 5 respostas chegaram esta semana e o formulário Orçamento trouxe mais leads."
- **CA-2** Sem respostas na semana: "Fulano, não tivemos respostas de formulários esta semana."
- **CA-3** Respostas na semana, mas nenhuma ligada a lead: "Fulano, 3 respostas chegaram esta semana." (sem citar formulário).
- **CA-4** Exatamente 1: singular ("1 resposta chegou", "1 lead entrou").
- **CA-5** Usuário que não participa de um tracking não vê leads nem o nome dele no resumo do Tracking.
- **CA-6** Falha na consulta não quebra o painel: aparece a pergunta fixa.

## 5. Casos de borda

- **CB-1** Sem organização ativa: `message: null`.
- **CB-2** Usuário sem nome: usa "Olá" no lugar do nome.
- **CB-3** Semana calculada no fuso do servidor (UTC em produção): perto da meia-noite de domingo a virada pode adiantar algumas horas. Aceito por ser só um resumo.

## 9. Riscos e rollback

Somente leitura, duas consultas agregadas com índice em `createdAt`. Rollback: remover o campo `briefingApp` do contexto do App e o painel volta à pergunta fixa.

## 10. Changelog da spec

- 2026-10-04 — criada e implementada (Formulários e Tracking).
- 2026-10-04 — RF-10: checagem de acesso por App e aviso de acesso negado; erro na consulta não prende mais o "digitando".
- 2026-10-04 — RF-9: resumo no balão de fala com o painel fechado.
- 2026-10-04 — resumo em todos os Apps: Chat (conversas esperando), Agenda (compromissos de hoje), Workspace (tarefas de hoje/atrasadas), Forge, Campanhas, Contatos, Pages, Linnker, N-Box, Insights, Planner, Route, trafeGO, Satélites, STAR FRIENDS, Space Station, Space Help, Financeiro e Contábil. "Hoje"/"semana"/"mês" no horário de Brasília (UTC-3), o que resolve o CB-3.
- 2026-10-04 — RF-6 a RF-8: "digitando" ao vivo, abertura fixa no topo e mensagem ao trocar de App.
