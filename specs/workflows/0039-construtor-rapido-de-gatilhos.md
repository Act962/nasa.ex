---
id: 0039
titulo: Construtor rápido de Gatilhos Automáticos (passo a passo, por frase e por lead)
dominio: workflows
status: implementada
autor: Weydson
criada: 2026-09-27
atualizada: 2026-09-27
branch: feature/W-tracking-chat-gatilho-do-lead-20260927
pr:
peso: completa
---

# 0039 — Construtor rápido de Gatilhos Automáticos

## 1. Contexto

"Criar comando", no popup "Gatilho do lead" (spec 0038), abre o comando do ASTRO — agente de
IA, sem relação com o lead nem com as automações do tracking. Os Gatilhos Automáticos (workflows)
só se montam no canvas, que exige conhecer a paleta inteira. Pedido do usuário (2026-09-27): o
mesmo card do popup, com os recursos de gatilhos, ações, Apps ÓRBITA & Comunicação, Lógica, Dados
& Sub-Workflows e IA; um **modo rápido** linear, intuitivo e minimalista, também nos Gatilhos
Automáticos; montagem por frase ("Todo dia às 9h me lembra de retornar para Manoel"); e alerta de
lógica duplicada no lead.

Lacunas encontradas no mapeamento: não há gatilho de agenda nem ação que avise a equipe, e o
workflow vale para o tracking inteiro (sem escopo de lead). Não há detecção de duplicidade — só o
`collision-detector` ao ativar em modo agente.

## 2. Objetivo

Qualquer atendente monta um Gatilho Automático em poucos passos — escolhendo em selects ou
descrevendo numa frase — para um lead ou para o tracking, e é avisado se já existe um igual.

### Não-objetivos

- Substituir o canvas: ramificações (Se/Senão, Múltiplos casos, Decisão da IA) ficam no modo avançado.
- Migrar comandos do ASTRO Commander para workflows.

## 3. Requisitos

| ID | Requisito |
|---|---|
| RF-1 | Construtor rápido em card: 1º passo **"Quando"** (gatilho), depois passos **"Então"** em sequência. Cada passo: categoria (Ações · Apps ÓRBITA & Comunicação · Lógica · Dados & Sub-Workflows · IA) → tipo → campos essenciais. Nós sem campos rápidos entram marcados para revisão no modo avançado. |
| RF-2 | **Montar por frase**: a frase vira os passos (mesmo gerador do "Agente"), exibidos para revisão antes de criar. Ramificações fora do modo rápido avisam e mandam para o avançado. |
| RF-3 | **Modo avançado**: cria o workflow (inativo) e abre o canvas existente. |
| RF-4 | No popup do lead, **"Criar comando"** abre o construtor já com o lead (escopo por lead). Em Gatilhos Automáticos, botão **"Modo rápido"** abre o mesmo construtor para o tracking inteiro. |
| RF-5 | Gatilho novo **"Agendado"**: todo dia, dias da semana escolhidos, ou uma vez em data e hora (São Paulo). |
| RF-6 | Ação nova **"Lembrar a equipe"**: notificação (sino + popup do ASTRO) para o responsável do lead ou para quem criou; mensagem com `{{lead.name}}`. |
| RF-7 | Workflow com `leadId` só roda para esse lead; qualquer outro disparo é ignorado. |
| RF-8 | **Alerta de duplicação**: antes de criar, compara com os workflows ativos do mesmo tracking (do mesmo lead ou do tracking todo) — mesmo gatilho e mesma configuração do gatilho, com ações em comum — e mostra quais. Não bloqueia. |
| RNF-1 | O agendado reserva cada horário numa tabela de claim única: produção e Inngest local no mesmo banco disparam uma vez só. |
| RNF-2 | Construtor usa as mesmas regras do canvas: criação por `createWorkflowFromBlueprint`, `agentMode = true`. |

## 4. Critérios de aceite

- [x] **CA-1** — "Todo dia às 9h me lembra de retornar para Manoel" vira: Agendado (todo dia 09:00) → Lembrar a equipe, com o lead Manoel no escopo.
- [x] **CA-2** — Montar pelos selects (Lead com Tag → Enviar Mensagem → Esperar 2 dias → Enviar Mensagem) cria um workflow linear que abre no canvas com as mesmas ligações.
- [ ] **CA-3** — Workflow com `leadId` disparado para outro lead não executa.
- [x] **CA-4** — O mesmo horário agendado não dispara duas vezes, mesmo com duas varreduras.
- [x] **CA-5** — Criar um gatilho igual a um ativo mostra o alerta com o nome do existente.

## 5. Decisões

- **D-1 — "Criar comando" do lead cria Gatilho Automático** (usuário, 2026-09-27), não comando do ASTRO.
- **D-2 — Nós novos `SCHEDULE_TRIGGER` e `NOTIFY_TEAM`** (usuário, 2026-09-27), com migration no enum `NodeType`.
- **D-3 — Entrega única** (usuário, 2026-09-27).
- **D-4 — Escopo por lead é uma coluna (`Workflow.leadId`)**, checada na entrada da execução: um ponto só, em vez de mexer em cada `findMany` de gatilho.
- **D-5 — Duplicação compara gatilho + configuração + ações em comum**: igualdade exata de grafo deixaria passar o caso comum (mesma mensagem com texto um pouco diferente).
- **D-6 — O modo rápido só oferece nós que o motor em modo agente executa.** Temperatura, Responsável, Ganho/Perdido, Filtrar leads e os "Enviar formulário/agenda/Linnker" não têm executor lá e falhariam ao rodar; continuam na paleta do canvas clássico.

## 6. Modelo

- `NodeType`: `+SCHEDULE_TRIGGER`, `+NOTIFY_TEAM`.
- `Workflow.leadId String?` (índice), relação opcional com `Lead` (`SetNull`).
- `WorkflowScheduleClaim { workflowId, slotKey, createdAt }`, `@@unique([workflowId, slotKey])`.
- `SCHEDULE_TRIGGER.data.schedule`: `{ frequency: "DAILY" | "WEEKDAYS" | "ONCE", time: "HH:mm", weekdays?: number[], date?: "YYYY-MM-DD" }`.
- `NOTIFY_TEAM.data`: `{ message, target: "RESPONSIBLE" | "USER", userId }`.

## 9. Changelog

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-27 | Weydson | Criada a partir do pedido e das decisões D-1 a D-3. |
| 2026-09-27 | Weydson | Implementada. CA-1, 4 e 5 conferidos por `scripts/astro-qa/check-quick-builder.ts` na org de QA, pela rota oRPC real. CA-2 conferido na ida e volta passos ↔ blueprint (a abertura no canvas não foi vista). CA-3 (escopo por lead na execução) pendente: precisa do Inngest local rodando. Correção de passagem: o gerador de blueprint por frase (também usado pelo "Agente de Gatilhos Automáticos") falhava no modo estrito da OpenAI — agora `strictJsonSchema: false`. |
| 2026-09-27 | Weydson | Antes do PR: "Criar comando" do topo do chat vira **"Gatilhos do lead"** (ícone de gatilho, luz na borda sem verde) e abre o criar gatilho com o lead da conversa aberta; no popup do lead, "Criar comando" vira "Criar gatilho". Os 10 gatilhos e as 15 ações do catálogo rodados no motor (`scripts/astro-qa/check-quick-builder-nodes.ts`): todos ok. **Corrigido:** "Mover lead" no motor avançado nunca funcionava em fluxos gerados (blueprint, Agente, modo rápido) — o adaptador passava `data.action.statusId` sem `trackingId` para o executor antigo, que lê na raiz. |
