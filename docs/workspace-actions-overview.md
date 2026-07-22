# Workspace + Actions ↔ Tracking + Leads — Visão Geral

> Documento vivo do elo entre o domínio **Workspace/Action** (execução: quadros, tarefas, eventos) e o domínio **Tracking/Lead** (comercial: pipeline, contatos). Última revisão: 2026-07-22 (**Fase 1** — vínculo Tracking → Workspaces).
>
> **Regra de manutenção:** sempre que alterar qualquer coisa em `src/features/workspace/`, `src/features/actions/`, os routers `src/app/router/leads/`, ou os modelos `Workspace`/`WorkspaceColumn`/`WorkspaceMember`/`Action`/`SubActions` no `prisma/schema.prisma`, **atualize este arquivo na mesma sessão** — tabelas, roadmap/status, decisões e changelog sincronizados com o código. Espelha a regra dos itens 10 e 14 do CLAUDE.md.

---

## 1. Objetivo

Hoje a NASA tem dois domínios maduros que **não conversam**:

- **Tracking/Lead** — pipeline comercial. Quem é o lead, em que etapa está, quem é o responsável, qual o histórico.
- **Workspace/Action** — execução. Quadros kanban com tarefas, reuniões, eventos e notas.

O schema do Prisma **já modela** a ponte entre os dois (`Workspace.trackingId`, `Action.trackingId`, `Action.leadId`), mas nenhuma dessas colunas tem escritor vivo no código. O resultado é que a operação comercial e a execução vivem em silos: não dá pra ver "quais tarefas existem para este lead" nem "quais quadros pertencem a este funil".

O objetivo desta linha de trabalho é **ativar essas pontes** de forma incremental e segura, começando pela mais estrutural (Workspace → Tracking) e descendo até o vínculo fino (Action → Lead).

---

## 2. Estado Atual

| Item | Status |
| --- | --- |
| Fase em andamento | **Fase 1 em implementação 🚧** — vínculo Tracking → Workspaces (1:N), com seleção na criação e na aba Geral das configurações |
| `Workspace.trackingId` | 🚧 Sempre `null` até a Fase 1 aterrissar — nenhum caminho grava o campo |
| `Action.trackingId` | ⬜ Sempre `null` — nenhum caminho de criação preenche (ver §5, Fase 2) |
| `Action.leadId` | ⬜ Sempre `null` — fluxo lead→action comentado no código (ver §5, Fase 3) |
| Validação de coerência | ⬜ Inexistente — nada garante que lead/tracking/workspace/org sejam consistentes entre si (ver §6) |
| Dívidas de segurança | 🚧 Mapeadas em §6, **não corrigidas** salvo onde indicado |

---

## 3. Mapa do Modelo de Dados

### 3.1 As três pontes

| Ponte | Coluna | Cardinalidade | Delete |
| --- | --- | --- | --- |
| Workspace → Tracking | `Workspace.trackingId` ([schema.prisma:1170](../prisma/schema.prisma)) | **1 tracking : N workspaces** | `SetNull` |
| Action → Tracking | `Action.trackingId` ([schema.prisma:1280](../prisma/schema.prisma)) | 1 tracking : N actions | `SetNull` |
| Action → Lead | `Action.leadId` ([schema.prisma:1283](../prisma/schema.prisma)) | 1 lead : N actions | `SetNull` |

> **Nota importante:** a cardinalidade 1:N de tracking→workspaces **já existia no schema** desde sempre — `trackingId` é uma FK nullable no lado `Workspace`, então N workspaces podem apontar pro mesmo tracking. A Fase 1 **não precisou de migration**; foi puramente wiring de aplicação.

### 3.2 Hierarquia

```
Organization
 ├─ Tracking ──────────────┐  (1:N)
 │   ├─ Status             │
 │   │   └─ Lead ──────────┼──┐  Action.leadId (1:N)
 │   ├─ TrackingParticipant│  │
 │   └─ TrackingConsultant │  │
 │                         │  │
 └─ Workspace ◄────────────┘  │  Workspace.trackingId (N:1)
     ├─ WorkspaceColumn        │
     ├─ WorkspaceMember        │
     └─ Action ◄───────────────┘
         ├─ SubActions
         ├─ ActionsUserParticipant
         └─ ActionsUserResponsible
```

`Action` carrega **cinco** FKs denormalizadas: `workspaceId` (obrigatória), `columnId`, `trackingId`, `leadId`, `organizationId`, `orgProjectId`. Todas exceto `workspaceId` são nullable e nenhuma tem invariante garantida em código.

---

## 4. Modelos de Permissão (dois, desconectados)

### 4.1 Tracking — opt-in explícito

Acesso é dado por `TrackingParticipant` (com `ParticipantRole`). As listagens filtram `participants: { some: { userId } }`:

- [`list-trackings.ts:24`](../src/app/router/trackings/list-trackings.ts)
- [`list-dashboard.ts:36`](../src/app/router/trackings/list-dashboard.ts)

Customização do board é gated em `TrackingParticipant.role === "OWNER"` (ver `use-can-customize-board.ts`).

### 4.2 Workspace — org inteira por padrão

`WorkspaceMember` existe com `WorkspaceMemberRole` (OWNER/MEMBER/VIEWER), mas [`workspace.create`](../src/features/workspace/server/routes/create.ts) insere **todos os membros da organização** automaticamente (criador vira `OWNER`, o resto `MEMBER`). Na prática, membership de workspace ≈ organização inteira.

Os caminhos de leitura de actions (`listByWorkspace`, `listByColumn`, `searchActions`) filtram pelo **`Member.role` do better-auth**, não pelo `WorkspaceMember.role`:

```ts
// list-action-by-workspace.ts:33-55 (resumo)
if (member.role === "member") visibilityFilter = { OR: [{ createdBy }, { participants }] };
// qualquer outro role → visibilityFilter = {} (vê tudo)
```

### 4.3 Consequência

Os dois sistemas **não se sincronizam**. Participante de tracking não vira membro de workspace, e vice-versa. Ao vincular um workspace a um tracking (Fase 1), o vínculo é **organizacional//informativo**, não propaga permissão. Qualquer fase futura que queira propagar acesso precisa decidir explicitamente a direção da sincronização.

---

## 5. Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| **1** | **Vínculo Tracking → Workspaces (1:N).** `trackingId` gravável em create/update, filtro em list, seletor na UI de criação e configurações | **🚧 Em implementação** |
| **2** | **Herança `Action.trackingId`.** Action criada num workspace vinculado herda o `trackingId` do workspace; backfill das actions existentes | ⬜ Planejada |
| **3** | **Reativar vínculo Action → Lead.** Ressuscitar o fluxo lead→action (hoje 100% comentado), com seletor de lead na action e aba de tarefas no detalhe do lead | ⬜ Planejada |
| **4** | **Validação de coerência.** Garantir que `leadId` pertence ao `trackingId`, que o workspace pertence à org, e que `move-action` atualiza os campos denormalizados | ⬜ Planejada |
| **5** | **Endurecimento de permissão.** Fechar as rotas sem checagem de recurso listadas em §6 | ⬜ Planejada |

---

## 6. Dívidas Conhecidas

Levantadas na análise de 2026-07-22. **Não corrigidas** salvo indicação em contrário — documentadas aqui pra não se perderem.

### 6.1 Segurança

| # | Onde | Problema |
| --- | --- | --- |
| S1 | [`leads/update-action-by-lead.ts:9`](../src/app/router/leads/update-action-by-lead.ts) | Sem `requireOrgMiddleware`, sem checagem de dono do `actionId`, e grava `createdBy: context.user.id` em toda atualização → qualquer autenticado reatribui autoria de qualquer action por id |
| S2 | [`leads/list-actions.ts:58`](../src/app/router/leads/list-actions.ts) | `where: { leadId }` sem escopo de org → leitura cross-tenant por id de lead |
| S3 | [`workspace/update.ts`](../src/features/workspace/server/routes/update.ts) | Atualiza por id sem checar org → escrita cross-org (alvo da Fase 1) |
| S4 | `actions/list-action-by-workspace.ts:85` | `where: { workspaceId }` sem escopo de org → role privilegiado da org A lê actions de workspace da org B |
| S5 | `actions/` — ~18 procedures | `update`, `toggleDone`, `reorder`, `addParticipant`, `createSubAction` e afins rodam com auth+org apenas, **zero checagem de recurso** |

### 6.2 Consistência

| # | Onde | Problema |
| --- | --- | --- |
| C1 | [`workspace/move-action.ts:28`](../src/features/workspace/server/routes/move-action.ts) | Move `workspaceId` sem atualizar `organizationId`/`trackingId`/`orgProjectId` → campos denormalizados rançosos |
| C2 | `actions/create.ts:100` | Grava `workspaceId` ao lado de `organizationId` sem verificar que o workspace pertence àquela org |
| C3 | `workspace/approve-share.ts:60` | Copia pra `targetWorkspaceId` não validado |

### 6.3 Código morto

| # | Onde | Situação |
| --- | --- | --- |
| D1 | [`leads/create-action-by-lead.ts`](../src/app/router/leads/create-action-by-lead.ts) | Arquivo inteiro comentado (linhas 1-71); registro em `leads/index.ts:16,58` também comentado |
| D2 | [`leads/components/notes/index.tsx:38`](../src/features/leads/components/notes/index.tsx) | Botão "Adicionar nota" é `onClick={() => {}}` — no-op |
| D3 | `ActionMirror` (schema.prisma:3710) | Modelo sem nenhuma referência em `src/` — zero hits fora do generated |
| D4 | `workspace-calendar-modal.tsx:171` | Filtro de leads deduz leads das actions do mês; com `leadId` sempre null, a lista sai vazia |

---

## 7. Changelog

### 2026-07-22 — Fase 1: vínculo Tracking → Workspaces 🚧

Ativa a primeira ponte. Um tracking pode ter **vários** workspaces; um workspace pertence a **no máximo um** tracking (ou nenhum — o vínculo é opcional).

**Sem migration** — `Workspace.trackingId` já existia no schema com índice.

| Arquivo | Mudança |
| --- | --- |
| `workspace/lib/tracking-link.ts` | **Novo.** `isTrackingAccessibleByUser` — valida que o tracking existe, pertence à org, não está arquivado e que o usuário é participante |
| `workspace/server/routes/create.ts` | Aceita `trackingId` opcional; valida antes de gravar |
| `workspace/server/routes/update.ts` | Aceita `trackingId` nullable (`null` desvincula); **passa a checar escopo de org** (fecha S3) |
| `workspace/server/routes/list.ts` | Aceita filtro opcional `trackingId`; inclui `tracking { id, name }` no retorno |
| `workspace/server/routes/get.ts` | Inclui `tracking { id, name }` no retorno |
| `workspace/hooks/use-workspace.ts` | `useWorkspacesByTracking` — lista workspaces de um tracking |
| `workspace/components/modals/create-workspace-modal.tsx` | Seletor de tracking (opcional) |
| `workspace/components/modals/tabs/general-tab.tsx` | Seletor de tracking com opção de desvincular |

**Decisões:**

- **Vínculo opcional, não obrigatório.** Workspaces avulsos (sem tracking) continuam sendo o caso normal — muitos quadros não são comerciais. Forçar vínculo quebraria os workspaces existentes.
- **Vínculo não propaga permissão.** Ligar um workspace a um tracking não adiciona os participantes do tracking como membros do workspace, nem o contrário. Os dois modelos de permissão continuam independentes (ver §4.3). Isso é deliberado pra manter a fase pequena e reversível; se a propagação for desejada, vira uma fase própria com decisão explícita de direção.
- **Validação exige participação no tracking.** Não basta o tracking ser da mesma org: o usuário precisa ser `TrackingParticipant`. Caso contrário seria possível descobrir/vincular trackings dos quais não se participa.
- **Trackings arquivados não são vinculáveis**, mas um vínculo existente sobrevive ao arquivamento do tracking (não há cascade — o campo só vira `null` se o tracking for deletado).
