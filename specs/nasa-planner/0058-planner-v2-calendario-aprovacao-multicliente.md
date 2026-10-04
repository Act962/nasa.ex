---
id: 0058
titulo: Planner v2 — calendário, aprovação e multi-cliente
dominio: nasa-planner
status: implementada
autor: Weydson
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: completa
---

# 0058 — Planner v2: calendário, aprovação e multi-cliente

## 1. Contexto

O Planner só enxerga a org ativa, tem um calendário mensal simples e uma "aprovação" que só troca o status. Quem atende vários clientes (cada cliente é uma org com o próprio Instagram nos Satélites) precisa trocar de empresa para cada post. O Planner da Meta tem Semana/Mês, horários sugeridos, rascunhos, momentos e metas — mas não atende várias empresas nem tem fluxo de aprovação. Esta spec cobre a base da v2 (Fase 1). Publicação confiável está na spec 0057.

## 2. Objetivo

Num único calendário, o usuário planeja (roteiro), cria, aprova e programa posts de Feed, Carrossel, Reel e Story de todos os clientes a que tem acesso, com o humano aprovando antes de qualquer publicação.

### Não-objetivos

- Comments e disparo WhatsApp no calendário (Fase 2).
- Tools do Astro/WhatsApp, ações em massa e IA de roteiro (Fase 3).
- MCP do ÓRBITA / Claude Code (Fase 4).
- Melhor horário a partir de insights reais (Fase 5) — aqui os horários vêm de padrão + cadência manual.
- Reescrever mapa mental, campanhas e popup do Workspace.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Status do post: IDEA → DRAFT → PENDING_APPROVAL ⇄ CHANGES_REQUESTED → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED / FAILED. |
| RF-2 | Editar mídia ou legenda de um post APPROVED/SCHEDULED volta para DRAFT e desprograma. |
| RF-3 | Enviar para aprovação define revisor opcional e notifica; pedir ajustes exige comentário (pode apontar um slide); aprovar registra quem e quando. |
| RF-4 | Checklist de marca automático a partir do brand kit do planner: palavras proibidas, hashtags, logo/cores (manual), regras do formato. |
| RF-5 | Programar exige APPROVED, exceto quando a org desliga a aprovação obrigatória (padrão: ligada em org com mais de um membro). |
| RF-6 | Calendário Semana (horas) e Mês, botão Hoje, navegação ‹ ›, filtros por cliente (org), tipo, status, pilar e conta. |
| RF-7 | Horários sugeridos (slots) aparecem como cartões tracejados "Programar" que abrem o criador já com data/hora. |
| RF-8 | Arrastar post para outro horário reprograma; arrastar rascunho do painel para um horário abre a confirmação de programação. |
| RF-9 | Painel lateral: Metas (cadência por tipo × realizado), Momentos (datas comemorativas BR + eventos de campanha), Rascunhos (IDEA, DRAFT, CHANGES_REQUESTED) e Aprovação (fila, com contador). |
| RF-10 | Criador em passos Roteiro → Criação → Revisão → Programação, com prévia por formato (Story 9:16 sem legenda). |
| RF-11 | Multi-cliente: lista as orgs do usuário onde ele tem permissão `nasa-planner`; leituras cruzam só essas orgs; toda escrita usa a org do post e checa a permissão nela. |
| RF-12 | Pilares de conteúdo por planner (nome, cor de token, % alvo) e roteiro (`script`) no post. |
| RF-13 | Origem do post registrada (`WEB`, `ASTRO`, `WHATSAPP`, `MCP`) para mostrar "enviado por Claude Code de Fulano". |
| RF-14 | Celular: dock (Hoje, Criar, Rascunhos, Aprovação), agenda em cartões, criador e revisão em gaveta, "Mover para…" no lugar de arrastar. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | `calendar.list` limitado a 62 dias por consulta; payload leve (sem legenda inteira). |
| RNF-2 | Datas gravadas em UTC e exibidas no fuso da org. |
| RNF-3 | Componentes novos com menos de 400 linhas; Design System (tokens, `rounded-full`, cartões `rounded-[18-20px]`, sem roxo). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um usuário membro de 3 orgs com permissão, quando abre o Planner, então vê as 3 no filtro de clientes e os posts das 3 no calendário.
- [ ] **CA-2** — Dado uma org onde o usuário não tem `view` no Planner, então ela não aparece e seus posts não voltam em `calendar.list`.
- [ ] **CA-3** — Dado um post de uma org onde o usuário não tem `create`, quando tenta editar, então recebe FORBIDDEN.
- [ ] **CA-4** — Dado um post APPROVED, quando a legenda é editada, então ele volta a DRAFT e sai do horário.
- [ ] **CA-5** — Dado aprovação obrigatória, quando tento programar um DRAFT, então a ação é bloqueada com a mensagem "Envie para aprovação primeiro".
- [ ] **CA-6** — Dado um pedido de ajustes, então o post vai para CHANGES_REQUESTED, aparece em Rascunhos e o autor é notificado.
- [ ] **CA-7** — Arrastar um post programado para outro dia muda `scheduledAt` e reprograma (spec 0057, RF-5).
- [ ] **CA-8** — Clicar em "Programar" num horário sugerido abre o criador com a data/hora do slot.
- [ ] **CA-9** — No celular, o calendário vira agenda em cartões e o criador abre em gaveta.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Org do cliente sem Instagram conectado | Cliente aparece no filtro com aviso "Conecte o Instagram nos Satélites"; criar post fica como rascunho. |
| CB-2 | Conta em NEEDS_RECONNECT | Ponto de alerta no filtro e no post; programar avisa antes. |
| CB-3 | Org sem planner | Cria "Planner principal" sob demanda ao criar o primeiro post. |
| CB-4 | Usuário perde acesso a uma org | Some do filtro na próxima consulta; posts dele lá ficam com a org. |
| CB-5 | Revisor é o próprio autor | Permitido se tiver permissão `approve`; registro mostra autoaprovação. |
| CB-6 | Dois revisores aprovando ao mesmo tempo | Primeira aprovação vale; a segunda vira comentário. |
| CB-7 | Arrastar para horário passado | Bloqueado com aviso; "Publicar agora" é a alternativa. |
| CB-8 | `NasaPlanner.clientOrgId/clientOrgName` legados | Somente leitura; o cliente passa a ser a org. |

## 6. Decisões de design

### D-1 — Cliente é uma org

- **Escolha**: cada cliente tem a própria org e Satélites; o Planner cruza as orgs do usuário.
- **Alternativas descartadas**: clientes dentro de uma org (exigiria vários logins Meta por org e outra camada de permissão).
- **Consequência**: procedures novas não usam `requireOrgMiddleware`; usam `resolvePlannerOrgs` (padrão de `src/app/router/insights/resolve-insights-organizations.ts`).

### D-2 — Aprovação como histórico, não só status

- **Escolha**: `NasaPlannerPostReview` guarda envio, comentários, pedidos de ajuste e aprovação.
- **Alternativas descartadas**: campos soltos no post (perde a conversa e quem pediu o quê).

### D-3 — Calendário como tela inicial

- **Escolha**: `/nasa-planner` abre o calendário; a lista de planners vai para `/nasa-planner/planners`.
- **Alternativas descartadas**: nova aba dentro de cada planner (continua preso a uma org).

## 7. Impacto

- [x] Schema / migration — status `IDEA`, `CHANGES_REQUESTED`; colunas de aprovação/roteiro/origem em `NasaPlannerPost`; `NasaPlannerPostReview`, `NasaPlannerContentPillar`, `NasaPlannerPublishSlot`, `NasaPlannerCadenceGoal`.
- [x] Procedures oRPC — `clients.list`, `calendar.list/drafts/slots/moments`, `goals`, `slots`, `pillars`, `approval.*`, `posts.create` com `organizationId`.
- [ ] Realtime
- [ ] Automações
- [ ] Env vars novas
- [ ] Breaking change — rota `/nasa-planner` muda de lista para calendário (lista em `/nasa-planner/planners`).
- [x] Documentação — `docs/nasa-planner-overview.md`, guias do Astro (`planner.*`), changelog do playbook mobile.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-3 | automatizado (quando houver runner) / manual | Usuário com 3 orgs e papéis diferentes. |
| CA-4 a CA-8 | manual | Fluxo completo no calendário. |
| CA-9 | manual | Viewport de celular. |

## 9. Riscos e rollback

- Vazamento entre orgs: toda procedure resolve a org pelo recurso; revisar cada uma no PR.
- Migration aditiva; valores de enum não são removíveis (ficam sem uso no rollback).
- Rollback: a tela antiga (`NasaPlannerApp`) continua em `/nasa-planner/[plannerId]` durante uma versão.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-04 | Weydson | Criada |
| 2026-10-04 | Weydson | Aprovada e implementada (Fase 1). Programar não cancela por evento: a troca de `scheduleVersion` impede a execução antiga de publicar. |
| 2026-10-04 | Weydson | Painel lateral (RF-9) substituído por abas no topo: Dashboard (Metas, Momentos, "Precisa de você"), Calendário com Semana/Mês/Kanban (Rascunhos e Aprovação viram colunas), Campanhas e Mapas Mentais. |
