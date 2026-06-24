# Realtime Board Broadcasts — Reference

Pipeline que mantém os boards de Tracking (leads) e Workspace (actions) sincronizados em tempo real quando uma automação Inngest altera um entity em background. Use este documento como ponto de partida para entender o sistema **e** como recipe para adicionar novas automações.

---

## Por que existe

Antes deste pipeline, automações Inngest (mover lead, mudar tag, etc.) atualizavam o banco mas o board aberto no navegador não enxergava a mudança até o usuário dar refresh. Resultado: percepção de que a automação não funcionou, ciclo de F5.

Hoje: cada automação publica num canal de realtime, o board assina o canal e dispara `queryClient.invalidateQueries` escopado às colunas/cards afetados. UI atualiza em ~1s sem refresh, sem mexer em estado otimista.

> ⚠️ **Transporte por board (importante):**
> - **Board de leads (tracking)** → migrado para **Pusher**, via a camada de abstração de realtime (`src/lib/realtime/`). O Inngest realtime não funcionava em produção. O domínio depende da **porta** `RealtimePublisher`/`RealtimeSubscriber`; o Pusher é só o adapter, plugado no composition root `src/lib/realtime/index.ts` (trocar de lib = trocar esse arquivo).
> - **Board de actions (workspace)** → ainda em **Inngest realtime** (token + `useInngestSubscription`). As seções abaixo que falam de token/`getSubscriptionToken`/watermark valem só para actions.

---

## Arquitetura

```
Workflow Inngest                       Cliente (board aberto)
─────────────────                      ──────────────────────
executor.ts                            useBoardRealtimeSync (lead)
  └─ prisma.X.update(...)              useBoardActionsRealtimeSync (action)
  └─ publishLeadChanged/Moved/Closed     │
       └─ Channel.pub                    ├─ useInngestSubscription
                                         ├─ debounce 250ms (max 2s)
                                         ├─ watermark lastSeenIdx
                                         ├─ pause se aba oculta
                                         └─ invalidateQueries escopado
```

### Canais (1 por board, N tópicos)

| Canal | Transporte | Parametrizado por | Tópicos |
|---|---|---|---|
| `private-board-leads-{trackingId}` | Pusher | `trackingId` | `lead-created`, `lead-moved`, `lead-changed`, `lead-closed` |
| `boardActionsChannel` | Inngest | `workspaceId` | `action-moved`, `action-changed`, `action-archived`, `sub-action-created` |

Definição: [src/features/leads/realtime/board-leads-channel.ts](../src/features/leads/realtime/board-leads-channel.ts) (leads/Pusher — nome do canal + contrato tipado `BoardLeadsEvents`), [src/inngest/channels/board-actions.ts](../src/inngest/channels/board-actions.ts) (actions/Inngest).

**Por que um canal por board e não um por automação?** Cada cliente assina **um** WebSocket por board aberto, não N. Adicionar uma nova automação não cria mais conexões — só mais tópicos no mesmo canal.

### Helpers de publish

[src/features/leads/realtime/publish.ts](../src/features/leads/realtime/publish.ts) — publicam pela **porta** `realtimePublisher` (`@/lib/realtime`), sem arg `publish` do Inngest:
- `publishLeadCreated({ leadId, trackingId, statusId, source? })` — lead novo entrou no board. `source` default `"form"`. Disparado pelas procedures públicas de formulário (ver abaixo), não pelos executors.
- `publishLeadMoved(payload)` — cross-tracking, publica em ambos canais (origem + destino).
- `publishLeadChanged({ leadId, trackingId, statusId, fields })` — `fields` é union fechada (`"tag" | "temperature" | "responsible"`).
- `publishLeadClosed({ leadId, trackingId, statusId, outcome })`.

[src/features/actions/realtime/publish.ts](../src/features/actions/realtime/publish.ts):
- `publishActionMoved(publish, payload)` — cross-workspace, publica em ambos canais.
- `publishActionChanged(publish, { actionId, columnId, workspaceId, fields })` — `fields: "tag" | "participant"`.
- `publishActionArchived(publish, { actionId, columnId, workspaceId })`.
- `publishSubActionCreated(publish, { actionId, columnId, workspaceId, count })`.

**Todos** os helpers:
1. Skipam silenciosamente quando ID requerido vem null/empty.
2. Adicionam `source: "workflow"` e `at`/`movedAt` ISO automaticamente.
3. Isolam falha de transporte: nos de **leads**, o try/catch + log vive no adapter (`PusherRealtimePublisher`); nos de **actions**, no `safePublish` do próprio helper. Em ambos, falha de realtime nunca quebra o passo Prisma.

### Autorização da subscription

- **Leads (Pusher):** canal privado autorizado em [src/app/api/pusher/auth/route.ts](../src/app/api/pusher/auth/route.ts) via o registry de authorizers (`src/lib/realtime/channel-authorizers.ts` → `boardLeadsAuthorizer`). Regra: membership na org dona do `trackingId` (não autoria). Falha → 403, o client não assina.
- **Actions (Inngest):** [src/features/actions/realtime/actions.ts](../src/features/actions/realtime/actions.ts) emite token via `getSubscriptionToken(inngest, { channel, topics })`, validando sessão (`auth.api.getSession`), org ativa (`auth.api.getFullOrganization`) e membership do `workspaceId`. Falha lança `Error("Unauthorized" | "Forbidden")` — o `useInngestSubscription` não conecta.

### Hooks subscribers

[src/features/trackings/hooks/use-board-realtime-sync.ts](../src/features/trackings/hooks/use-board-realtime-sync.ts) (leads/Pusher) e [src/features/actions/hooks/use-board-actions-realtime-sync.ts](../src/features/actions/hooks/use-board-actions-realtime-sync.ts) (actions/Inngest):

- **Subscription (leads):** via hook genérico [`useRealtimeChannel`](../src/lib/realtime/use-realtime-channel.ts) — `bind` por evento + cleanup (`unbind`/`unsubscribe`). Como o Pusher entrega evento a evento (push), **não há watermark**: cada handler acumula nos refs e agenda o flush.
- **Subscription (actions):** `useInngestSubscription` entrega um array crescente; usa **watermark** `lastSeenIdxRef` para não reprocessar em re-renders.
- **Coalescência (ambos):** acumulam em janela de 250ms (debounce) com flush forçado a cada 2s. 1 invalidação por janela cobre N eventos heterogêneos.
- **Escopo da invalidação:** `pendingStatusRef`/`pendingColumnRef` agregam status/coluna afetados → invalidação por predicate apenas dos queries dessas IDs (não invalida o board inteiro).
- **Detalhes abertos:** `pendingLeadDetailRef`/`pendingActionDetailRef` agregam IDs de detalhe → invalida `orpc.{leads,action}.get`/`listHistoric` para sincronizar sheets/modais abertas.
- **Page Visibility API:** desliga subscription com aba oculta (`enabled: !!id && isVisible`); ao voltar, força refetch leve dos headers das colunas para reconciliar eventos perdidos.

### Zustand stores — unicidade cross-column

[src/features/trackings/lib/kanban-store.ts](../src/features/trackings/lib/kanban-store.ts) e [src/features/actions/lib/kanban-store.ts](../src/features/actions/lib/kanban-store.ts) `registerColumn(columnId, items)` purga itens da nova snapshot de **outras** colunas. Evita duplicação visual quando refetches da origem e destino chegam fora de ordem após um move por automação (caso da snapshot do destino chegar antes da origem).

---

## Como adicionar realtime para uma nova automação

### Passo 1 — Identifique o efeito no board

| Efeito | Use o tópico |
|---|---|
| Cria/insere card novo no board | `lead-created` (leads) |
| Move entre colunas/status | `lead-moved` / `action-moved` |
| Atualiza conteúdo do card sem trocar coluna | `lead-changed` / `action-changed` |
| Tira do board (closed/archived) | `lead-closed` / `action-archived` |
| Outro (ex.: cria entidade filha) | Adicionar tópico novo no canal e case no hook |

### Passo 2 — No executor

Em `src/features/{executions,workspace-executions}/components/<nome>/executor.ts`:

1. Importe o helper da feature:
   ```ts
   import { publishLeadChanged } from "@/features/leads/realtime/publish";
   // ou: publishActionChanged, publishActionArchived, etc.
   ```

2. Garanta que tem as IDs necessárias:
   - **Lead:** `LeadContext` já carrega `trackingId` e `statusId` — sem query extra.
   - **Action:** `ActionContext` só tem `id`. Faça `prisma.action.findUnique({ select: { columnId: true, workspaceId: true } })` antes da mutação.

3. Chame o helper **após** a mutação Prisma e **antes** do `publish(...success)` do canal de status (este último serve aos indicadores do editor de workflow, é coisa separada). Helpers de **leads** não recebem mais o arg `publish`:
   ```ts
   await publishLeadChanged({
     leadId: lead.id,
     trackingId: lead.trackingId,
     statusId: lead.statusId,
     fields: ["tag"],
   });
   ```

4. **Não** envolva em `try/catch` — o helper já isola.

### Passo 3 — Se for um `*-changed` com novo `field`

Adicione o literal ao type union: leads em [`src/features/leads/realtime/board-leads-channel.ts`](../src/features/leads/realtime/board-leads-channel.ts) (`LeadChangedField`), actions em `src/inngest/channels/board-actions.ts` (`ActionChangedField`). O hook **não precisa mudar** — ele só usa `statusId`/`columnId` para invalidar.

### Passo 4 — Se for um tópico novo

- **Leads (Pusher):** adicione a entrada evento→payload em `BoardLeadsEvents` (`board-leads-channel.ts`), publique pelo helper e adicione um handler em `useBoardRealtimeSync`. Sem token/`topics` — Pusher entrega todo evento do canal assinado.
- **Actions (Inngest):** `addTopic(...)` no canal, inclua no array `topics: [...]` da server action de token, atualize `BoardActionsToken`, e adicione um `case` no switch do hook.
- Em ambos, `flush` continua igual; só decida o que entra em `pendingStatusRef`/`pendingColumnRef`/`pendingDetailRef`.

### Passo 5 — Verificação

1. 2 abas abertas no mesmo board.
2. Disparar workflow numa, observar a outra atualizar em ~1s sem refresh.
3. DevTools Network: **leads** → frames WebSocket do Pusher (ou o Debug Console do dashboard Pusher mostrando o evento no canal `private-board-leads-{trackingId}`); **actions** → SSE em `/api/inngest` com `topic` correto.
4. React Query Devtools: apenas as queries do status/coluna afetado refetcham — **nunca** o board inteiro.

---

## Anti-patterns

- **Publicar fora do `step.run`** — perde a garantia de "publica só se a step succedeu". Se a step retry, o publish duplica sem mutação correspondente.
- **Esquecer o `at`/`movedAt` ISO** — quebra debug temporal e ordenação client-side futura. Os helpers já preenchem.
- **Adicionar tópico novo sem incluir no `topics: [...]` da server action** — clientes não recebem (servidor entrega só os tópicos assinados pelo token).
- **Mutar Zustand otimisticamente no subscriber** — regras de domínio (filtros, ordenação, SLA, statusFlow) vivem no servidor; refetch é a fonte da verdade.
- **Invalidar o board inteiro** (predicate só por `trackingId`/`workspaceId`) — quebra performance em bursts. Sempre escopar por status/columnId.
- **Publish sem `try/catch`** — falha de Inngest realtime (rede, queue cheia) propagaria erro e re-executaria a step. **Use sempre os helpers**, eles protegem.
- **Reaproveitar canais de node-status** (`moveLeadChannel`, `wsMoveActionChannel`, `tagChannel`, etc.) para broadcast de board — esses canais não têm chave por board e servem outro consumidor (indicadores do editor de workflow).

---

## Logs comuns no Inngest dev server

- `WRN error publishing to subscription error="failed to write msg: use of closed network connection"` — **benigno**: cliente WS fechou (HMR, refresh, navegação, StrictMode em dev).
- `WRN max failed keepalives` — mesma família, conexão zumbi.
- `INF new realtime connection topics=[...]` — handshake. Em dev React 18 StrictMode aparece duas vezes em ~4s.

Em produção, preocupar-se apenas se: alto volume de WRN (proxy/CDN com timeout WS), conexões acumulando (leak), ou `ERR` em publish.

---

## Fora de escopo

Itens que ainda **não** estão cobertos pelo pipeline (e que precisam de extensão deliberada quando virarem prioridade):

- **Mutações manuais** (drag de outro usuário, edição via UI) — além de execuções por automação, as procedures públicas de formulário ([submut-response.ts](../src/app/router/form/public/submut-response.ts) e [save-partial-response.ts](../src/app/router/form/public/save-partial-response.ts)) publicam `lead-created` quando criam um lead. Para multi-user real-time nas demais mutações, replicar o publish nas rotas oRPC `move-action`/`move-lead`/`update-lead`/etc.
- **UX de "card piscou"** — payload já carrega `source: "workflow"`; basta consumir do lado do componente.
- **Entidades filhas além de sub-action** — comentários, files, atividades não disparam broadcast.

---

## Roadmap / Próximas otimizações

Itens identificados na análise de impacto em produção que **não bloqueiam release**, mas vale revisar conforme a feature ganhar tração:

### Custo Inngest realtime — agregar publish por workflow run
**Quando:** se o dashboard Inngest mostrar custo crescendo desproporcionalmente, ou se um workflow rico (5+ steps no mesmo lead) ficar comum em bulk-import.
**Como:** em vez de cada executor publicar isoladamente, acumular as mudanças num campo do `context` ao longo do workflow e publicar **1 evento agregado** ao final (numa step `publish-board-events`). Reduz N eventos por lead/action para 1.
**Trade-off:** UI percebe mudanças em batches (não progressivamente). Em workflows curtos é imperceptível.

### WebSocket scaling — limites de plataforma
**Quando:** antes de subir pra prod, e quando boards abertos por usuário passar de ~5 em médio.
**Como:** confirmar limites de conexões concorrentes do plano Inngest contratado. Verificar timeout WS de Vercel/CDN intermediário (Vercel mata long-lived após ~5min sem keepalive — `useInngestSubscription` deve reconectar, mas vale validar). Se houver leak de conexão (cliente cresce sem soltar), investigar cleanup do hook.
**Mitigação possível:** centralizar subscriptions num service worker (1 WS por usuário em vez de 1 por aba/board), via `BroadcastChannel` para os hooks consumirem.

### Latência por automação — pré-carregar IDs no contexto
**Quando:** se cenários de >10k actions/min surgirem (bulk-import massivo).
**Como:** os executores `add-tag-action`, `add-participant`, `create-sub-action`, `archive-action` fazem 1 `findUnique` extra para obter `columnId`/`workspaceId`. Custo: ~5-10ms/automação. Para eliminar, expandir `ActionContext` em [src/features/workspace-executions/schemas.ts](../src/features/workspace-executions/schemas.ts) para carregar essas IDs já no trigger inicial do workflow.
**Trade-off:** schema do contexto fica menos enxuto; rotas que disparam workflow precisam preencher.

### UX — flicker de spinner em sheet aberta
**Quando:** se reports de "spinner pisca durante automação" aparecerem.
**Como:** o hook invalida `orpc.{leads,action}.get` a cada `*-changed`. Em workflow longo no mesmo entity, refetch dispara N vezes em sequência (a coalescência cobre dentro de 250ms, mas workflows que esperam entre steps sangram). Mitigação: trocar `invalidateQueries` por `setQueryData` quando o payload já carrega o suficiente, ou usar `refetchInterval` controlado em vez de invalidação imediata.

### Duplicação cross-column persistente
**Quando:** se reports de "card aparece em duas colunas" persistirem após o move.
**Como:** o fix atual de unicidade no Zustand purga itens duplicados na próxima refetch da snapshot que contém o item. Se a refetch da origem **falha** (rede, 500), a duplicação persiste até a próxima refetch natural. Mitigação: agendar `setTimeout(() => refetch(), 5000)` no subscriber para garantir reconciliação eventual.

### Drag interrompido por refetch remoto
**Quando:** se reports de "card pulou no drop" surgirem.
**Como:** o guard `isDragging` segura `setColumnList` durante o drag, mas refetches buffered aplicam logo no drop. Se a snapshot remota mudou a posição do card sob o dedo, o usuário vê pulo visual. Mitigação: estender o guard para incluir uma janela de `~200ms post-drop` antes de aplicar buffers.

### Feature flag para rollback rápido
**Quando:** primeiro release em produção.
**Como:** envolver os hooks `useBoardRealtimeSync`/`useBoardActionsRealtimeSync` em um check de env (`process.env.NEXT_PUBLIC_REALTIME_BOARD_ENABLED === "true"`). Permite desabilitar o subscriber sem redeploy se aparecer comportamento inesperado em prod (publish do servidor segue ligado, sem prejuízo).

### Métrica de observabilidade
**Quando:** desde o primeiro release.
**Como:** logger estruturado (não só `console.error`) nos `safePublish` dos helpers, contando publishes bem-sucedidos vs falhos por tópico. Spike em falhas = sinal de degradação do Inngest realtime ou rede. Considerar Sentry/Datadog tag `feature:realtime-board`.
