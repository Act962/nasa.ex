---
id: 0043
titulo: Empresa nova com conteúdo de exemplo em cada app e destaque "Clique aqui"
dominio: leads
status: aprovada
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-campanhas-disparo-self-service-20260927
pr:
peso: leve
---

# 0043 — Empresa nova já populada

## 1. Contexto

Complementa a [0042](0042-org-padrao-tags-automaticas-e-link-de-app.md). O dono pediu (2026-09-29): um lead no tracking "Atendimento" com contorno animado e seta "Clique aqui" para o cliente saber por onde começar, e todos os apps populados com exemplos para o cliente enxergar cada solução. Leiaute e lista por app aprovados pelo dono.

## 2. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Empresa nova (com dono) recebe, via Inngest `org-defaults/sample-content.seed`, conteúdo de exemplo: leads (5, um com conversa), Workspace, Formulários, Agenda, Forge, Linnker, N-Box, Pages, Planner, Route, Financeiro, STAR FRIENDS, e Space Station. |
| RF-2 | Nomes terminam em "(exemplo)"; o cliente apaga pela tela de cada app. Sem coluna nova. |
| RF-3 | O seed escreve direto no Prisma: sem cobrança de ⭐, sem Inngest/Pusher/rede, sem envio de mensagem ou campanha. |
| RF-4 | Card do tracking "Atendimento" (descrição padrão) e o lead "Maria (cliente exemplo)" mostram contorno azul animado + seta "Clique aqui". Some após o primeiro clique (por navegador, `localStorage`). |
| RF-5 | Falha num app não impede os outros (um step do Inngest por app). |

Fora: Campanhas (sem número oficial a tela de modelos dá erro), trafeGO (pedido pago), Astro Chat (cobrança mensal), Comments (canal Meta), NERP (ERP externo).

## 3. Critérios de aceite

- [ ] **CA-1** — Empresa criada pela tela mostra, em até 1 min, os exemplos em cada app de RF-1.
- [ ] **CA-2** — `/tracking` mostra o "Clique aqui" no Atendimento; no board, no lead de exemplo; somem depois do clique.
- [ ] **CA-3** — Conversa do lead de exemplo aparece no chat com 4 mensagens.
- [ ] **CA-4** — Nenhuma ⭐ debitada na criação.

## 4. Arquivos

- `src/features/org-defaults/lib/sample-content/*` — um seeder por app + `sample-leads.ts`.
- `src/features/org-defaults/lib/sample-lead.ts` — identificação do tracking/lead de exemplo e dispensa do destaque.
- `src/features/org-defaults/components/start-here-spot.tsx` — destaque animado.
- `src/inngest/functions/org-defaults/seed-sample-content.ts` — execução em segundo plano.
- `tracking-list.tsx`, `lead-item.tsx` — uso do destaque.

## 5. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Criada com a lista por app e o leiaute aprovados. |
