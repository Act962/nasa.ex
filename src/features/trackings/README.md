# Feature: Trackings (Pipeline / Kanban de Leads)

> Fonte de verdade do domínio de **Tracking de Leads** no lado do cliente.
> Cobre esta pasta (`src/features/trackings/`) — o board Kanban, arraste de
> leads/colunas, sincronização em tempo real, filtros, calendário de
> agendamentos e a IA de leads. As _procedures_ oRPC consumidas vivem em
> `src/app/router/**` e os componentes de servidor/prefetch em `src/features/<dominio>/server/`.

---

## 1. Visão geral

O **Tracking** é o CRM/pipeline de vendas do NASA: um board Kanban onde cada
**coluna é um `Status`** (etapa do funil) e cada **card é um `Lead`**. O usuário
arrasta leads entre etapas, reordena, filtra, marca ganho/perda, agenda
compromissos e conversa com uma IA que cria/move leads.

`src/features/trackings/` contém **apenas o client-side** desse domínio:
componentes React, hooks (wrappers oRPC + TanStack Query), contexts/stores
Zustand, o store do Kanban e os tipos. A lógica de servidor está nos routers
oRPC (`src/app/router/trackings`, `.../leads`, `.../status`, `.../agenda`).

### Rota de entrada

| Rota                                                        | O que renderiza                                  |
| ----------------------------------------------------------- | ------------------------------------------------ |
| `/tracking/[trackingId]`                                    | Board Kanban (`BoardContainer` + `KanbanCanvas`) |
| `/tracking/[trackingId]/appointments`                       | Calendário de agendamentos                       |
| `/` (dashboard)                                             | Lista de trackings (`TrackingList`)              |

---

## 2. Estrutura de pastas

```
src/features/trackings/
├── README.md              # Este arquivo
├── types.ts               # Tipo Lead (client-side, derivado do Prisma + campos server-computed)
├── lib/
│   └── kanban-store.ts     # Zustand store do board (colunas, ordem, drag, sort)
├── contexts/
│   ├── use-lead.tsx        # Zustand store — seleção múltipla de leads
│   └── use-view.tsx        # Zustand store — modo de visualização do card (default | modern)
├── hooks/                  # Wrappers oRPC + TanStack Query e utilitários de scroll
├── components/
│   ├── (board raiz)        # BoardContainer, KanbanCanvas, StatusColumn, LeadItem, Footer...
│   ├── filters/            # Barra de filtros do board
│   ├── calendar/           # Calendário de appointments
│   └── modal/              # Sheet de novo lead + botão de IA de leads
```

---

## 3. Modelos Prisma envolvidos

Definidos em [`prisma/schema.prisma`](../../../prisma/schema.prisma).

| Modelo                   | Papel                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `Tracking`               | O pipeline em si. Guarda nome, organização, projeto, flags de IA, e **toda a aparência** do board (cores/imagem de card, coluna e canvas do Kanban). |
| `Status`                 | Coluna do board. `order` é `Decimal(20,10)` (ordenação fracionária), `color`, `slaHours`, notificação ao cliente ao entrar. |
| `Lead`                   | Card. Nome/contato, `statusId`, `order` (Decimal), `temperature`, `currentAction` (ACTIVE/WON/LOST/DELETED), `statusFlow`, SLA, atribuição de campanha (UTM/Meta Ads/CTWA), `statusEnteredAt`, arquivamento. |
| `LeadTag`                | Join Lead↔Tag.                                                                                     |
| `LeadHistory`            | Histórico/auditoria por lead (`LeadEventType`: STATUS_CHANGE, TAG_ADDED, SLA_BREACHED, ...).       |
| `LeadJourneyEvent`       | Eventos de jornada do lead.                                                                        |
| `LeadFile`               | Anexos do lead.                                                                                    |
| `TrackingParticipant`    | Participantes (membros) com acesso ao tracking.                                                    |
| `TrackingCardConfig`     | Config por tracking: `cardVisibility` (JSON `fieldId → boolean`, campos visíveis no card/coluna), timer de SLA + thresholds da "cesta de compra". |
| `TrackingIdleAutomation` | Automação de leads ociosos (sem 1ª resposta / sem outbound), com modo fixo ou reabertura via IA.   |

**Enums-chave:** `LeadAction` (ACTIVE/WON/LOST/DELETED),
`Temperature` (COLD/WARM/HOT/VERY_HOT), `StatusFlow` (NEW/ACTIVE/WAITING/FINISHED),
`LeadEventType`.

---

## 4. Stores (Zustand)

### `lib/kanban-store.ts` — `useKanbanStore`

Coração do board. Espelha localmente as colunas para permitir **UI otimista** no
drag & drop, sem esperar o round-trip do servidor. Persiste apenas `sortBy` e
`headerCollapsed` no `localStorage` (`partialize`).

**Estado:**

| Campo               | Descrição                                                                        |
| ------------------- | -------------------------------------------------------------------------------- |
| `columns`           | `Record<statusId, { id, leads: Lead[] }>` — snapshot local dos leads por coluna. |
| `columnList`        | Ordem local das colunas (para reordenar sem refetch).                            |
| `sortBy`            | `"order" \| "createdAt" \| "updatedAt" \| "statusEnteredAt"` (default `statusEnteredAt`). |
| `isDragging`        | Bloqueia `registerColumn`/`setColumnList` enquanto arrasta (evita sobrescrever otimismo). |
| `activeDragLeadId`  | ID do lead em arraste — persiste ~0ms após `onDragEnd` para suprimir o click do `DragOverlay`. |
| `headerCollapsed`   | Recolhe a barra de filtros (persistido).                                         |
| `visibilityPreview` | Rascunho de visibilidade de campos enquanto o Sheet "Personalizar" está aberto (`CardVisibility \| null`, efêmero). Cards/colunas leem `visibilityPreview ?? cardVisibility` para preview ao vivo. |

**Ações principais:**

- `registerColumn(columnId, leads)` — injeta o resultado do `useInfiniteQuery` na
  coluna. Faz _diffing_ por `JSON.stringify` para não re-setar quando o conteúdo é
  idêntico (evita loop de re-render "Maximum update depth") e **expurga o lead de
  outras colunas** (unicidade cross-column quando uma automação move A→B).
- `moveLeadInColumn` / `moveLeadToColumn` — reordena/move otimista.
- `calculateMidpoint(columnId, overLeadId?)` — calcula o novo `order` fracionário
  (média de vizinhos via `Decimal`) para inserir sem renumerar a coluna toda.
- `getLeadNeighbors`, `findLeadColumn`, `getColumnLeads` — leitura.
- `moveColumn`, `setColumnList` — reordenação de colunas.

### `contexts/use-lead.tsx` — `useLeadStore`

Seleção múltipla de leads (checkbox nos cards). `selectedLeads`, `toggleLead`,
`addLead`, `removeLead`, `clearSelection`, `isSelected`. Alimenta as ações em
lote da `NavOptionsTracking`.

### `contexts/use-view.tsx` — `useView`

Modo de exibição do card: `"default" | "modern"`, persistido em `localStorage`
(`lead-card-view-mode`).

---

## 5. Hooks

Todos embrulham `orpc.*` com TanStack Query, seguindo a regra do projeto (nada de
`orpc` direto em componente). Mutations já invalidam as queries afetadas.

### `hooks/use-trackings.ts` — trackings, status, leads-por-status

| Hook                                  | Tipo             | Procedure oRPC                        | Papel                                                                 |
| ------------------------------------- | ---------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `useQueryTrackings`                   | query            | `tracking.list`                       | Lista de trackings do usuário.                                       |
| `useSuspenseTrackings`                | suspense query   | `tracking.list`                       | Idem, com Suspense.                                                  |
| `useDeleteTracking`                   | mutation         | `tracking.delete`                     | Arquiva o tracking (30 dias antes da exclusão).                      |
| `useQueryParticipants` / `useSuspenseParticipants` | query | `tracking.listParticipants`          | Participantes do tracking.                                           |
| `useQueryStatus`                      | query            | `status.getMany`                      | Colunas + contagem, com filtros (data, participante, tags, temperatura, ação). |
| `useInfiniteLeadsByStatus`            | infinite query   | `leads.listLeadsByStatus`            | **Paginação cursor** dos leads de uma coluna (limit 10), keyed por todos os filtros + `sortBy`. |
| `useUpdateColumnOrder`                | mutation (otim.) | `status.updateNewOrder`               | Reordena coluna com update otimista + rollback via snapshot.        |
| `useUpdateLeadOrder`                  | mutation         | `leads.updateNewOrder`                | Persiste a nova posição/coluna do lead após o drag.                 |
| `useDeleteStatus`                     | mutation         | `status.delete`                       | Remove uma coluna.                                                   |
| `useQueryAppointmentsByTrackfing`     | query            | `agenda.appointments.getManyByTracking` | Agendamentos do tracking (também em `use-appointments.ts`).       |

### `hooks/use-leads.ts` — mutações de lead

| Hook                          | Procedure                    | Papel                                                                 |
| ----------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `useMutationUpdateLeads`      | `leads.updateManyStatus`     | Move um/muitos leads de etapa; concede Space Point (`move_lead_stage`). |
| `useAddTags`                  | `leads.addTags`              | Adiciona tags + invalida queries do Insights e contagem de tags.     |
| `useAddTagsOptimistic`        | `leads.addTags`              | Versão otimista (atualiza `tags.getTagByLead` antes do round-trip).  |
| `useRemoveTagOptimistic`      | `leads.removeTags`           | Remove tag otimista com rollback.                                    |
| `useDeleteLead`               | `leads.delete`               | Exclui o lead.                                                       |
| `useArchiveLead`              | `leads.archive`              | Arquiva o lead.                                                      |

> `invalidateTagDependentQueries` (helper interno) invalida `insights.*` e
> `tags.listTags`/`getDuplicateTags` para manter gráficos e badges em sincronia.

### `hooks/use-appointments.ts`

- `useQueryAppointmentsByTrackfing` — `agenda.appointments.getManyByTracking`.
- `useQueryAppointment` — `agenda.appointments.get` (habilitado só com id).

### `hooks/use-lead-purchases.ts`

- `useLeadPurchasesByTracking` — `tracking.getLeadPurchases`. **Batch por
  tracking**: todos os cards compartilham a mesma queryKey, o React Query dedupa
  numa request só. `staleTime` 30s. Alimenta o ícone "cesta de compra".

### `hooks/use-kanban-appearance.ts`

- `useKanbanAppearance` — `tracking.getKanbanAppearance`. Cores/imagem do Kanban,
  `staleTime` 5min, compartilhado por board-container / status-column / lead-item.

### `hooks/use-card-config.ts` — visibilidade de campos + cesta

- `useCardConfig(trackingId)` — `tracking.getCardConfig`. Retorna a linha
  `TrackingCardConfig` (via `select`), com `cardVisibility`, `showPurchaseBasket`
  e thresholds. `staleTime` 30s, dedupado entre todos os cards/colunas.
- `useUpdateCardConfig()` — `tracking.updateCardConfig` (mutation), invalida
  `getCardConfig`. Consumido pelo Sheet "Personalizar" e pela aba Leads das
  Configurações (`tracking-settings`).

### `hooks/use-can-customize-board.ts`

- `useCanCustomizeBoard(trackingId)` — booleano de UX que libera o botão
  "Personalizar": `true` para Owner/Admin da org (`useOrgRole`) **ou** Owner do
  tracking (`tracking.listParticipants`). Espelha o gate do procedure
  `updateCardConfig` (o servidor é a fronteira de segurança).

### `hooks/use-tracking-ai.ts` — `useTrackingAi`

Chat de IA (Vercel AI SDK `useChat`) que fala com `client.ia.tracking.chat` via
_event stream_ oRPC. Ao terminar cada resposta, **aplica os efeitos das tool
calls no Kanban store de forma otimista**:

- `createLead` → insere card no topo da coluna alvo.
- `updateLead` → aplica patch (name/email/phone/description/temperature).
- `moveLeadToStatus` → move o card de coluna.
- `createWorkflow` / `addNode` / `connectNodes` → invalida/atualiza o editor de workflows.

### `hooks/use-board-realtime-sync.ts` — `useBoardRealtimeSync`

Subscreve o canal Pusher `boardLeadsChannelName(trackingId)` (=
`private-board-leads-{trackingId}`, contrato em
[`src/features/leads/realtime/board-leads-channel.ts`](../leads/realtime/board-leads-channel.ts))
e **invalida queries de forma coalescida** (debounce 250ms, teto 2s). Eventos:

| Evento         | Ação de invalidação                                                        |
| -------------- | -------------------------------------------------------------------------- |
| `lead-created` | invalida `status.getMany` + `listLeadsByStatus` do status afetado.         |
| `lead-moved`   | invalida colunas origem/destino + detalhe do lead.                         |
| `lead-changed` | invalida coluna + detalhe; se mudou `tag`, invalida `tags.getTagByLead`.   |
| `lead-closed`  | invalida coluna + detalhe do lead.                                         |

Desliga a subscription quando a aba fica oculta (`visibilitychange`) e revalida o
board ao voltar (compensa eventos perdidos). Ver também
[`docs/realtime-board-broadcast.md`](../../../docs/realtime-board-broadcast.md).

### Hooks de scroll (utilitários de UI puros)

- `use-grab-scroll.ts` — "arrastar para rolar" horizontal com pointer capture;
  ignora handles de drag/controles e suprime o click sintético pós-pan.
- `use-horizontal-scroll-map.ts` — métricas reativas (overflow / viewport /
  posição) via ResizeObserver + MutationObserver, alimenta o `KanbanMinimap`.

---

## 6. Componentes

### Board / Kanban (raiz)

| Componente             | Papel                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| `KanbanCanvas`         | Wrapper externo que aplica a **aparência** (bg/imagem/blur) para board + barra de filtros.               |
| `BoardContainer`       | **Orquestrador**. `DndContext` (mouse/touch/keyboard sensors), lê filtros da URL (`nuqs`), chama `useQueryStatus` + `useBoardRealtimeSync`, gerencia `onDragStart/Over/End`, minimapa e grab-scroll. |
| `StatusColumn`         | Coluna (memoizada). Renderiza header + lista infinita de `LeadItem` (`useInfiniteLeadsByStatus`), botão de adicionar lead. |
| `StatusWrapper`        | `<li>` container de largura fixa da coluna.                                                              |
| `StatusHeader`         | Cabeçalho da coluna: nome editável, cor, SLA, menu (deletar/config).                                     |
| `StatusForm`           | Form de criar/editar Status (React Hook Form + Zod).                                                     |
| `LeadItem`             | **Card do lead** (memoizado): nome/apelido, tags, temperatura, responsável, ícones (WhatsApp, formulários, agenda, SLA, cesta de compra), seleção. |
| `LeadForm`             | Criação rápida inline de lead ("Sem nome") no fim/topo da coluna.                                        |
| `LeadPurchaseBasket`   | Ícone colorido de "última compra" (verde→vermelho por antiguidade, thresholds do `TrackingCardConfig`). |
| `Footer`               | Drop-zones **Ganho / Perdido / Excluir** que aparecem só durante o arraste de um lead.                  |
| `KanbanMinimap`        | Minimapa de navegação horizontal das colunas.                                                           |
| `NavTracking`          | Navegação/topo do tracking.                                                                              |
| `NavOptionsTracking`   | Ações em lote sobre leads selecionados (mover de tracking, etc.).                                        |
| `TrackingList`         | Dashboard: lista de trackings (`tracking.listDashboard`, Suspense).                                      |
| `TrackingAppearanceDialog` | Dialog de personalização visual do card/board.                                                      |
| `AddParticipantDialog` | Adiciona participante ao tracking.                                                                       |

### `filters/`

Barra de filtros (`FiltersTracking` em `filters/index.tsx`), recolhível via
`headerCollapsed`. Cada filtro escreve na **URL** (`nuqs`), consumida pelo
`BoardContainer`:

`Filters` (container) · `TrackingSwitcher` · `ParticipantsSwitcher` ·
`ProjectsFilter` · `TagsFilter` · `TemperatureFilter` · `WinLossFilter` ·
`StatusFlowFilter` · `SorterLead` (troca `sortBy` do store) · `CalendarFilter`
(intervalo de datas).

### `calendar/`

`AppointmentCalendar` (mês, cores por agenda) · `AppointmentCard` ·
`DayEventsPopup` · `ViewAppointment` / `DeleteAppointmentDialog`. Consomem
`agenda.appointments.*`.

### `modal/`

- `AddLeadSheet` — Sheet completo de criação de lead (concede Space Point).
- `BoardCustomizeSheet` — Sheet "Personalizar board" (lado direito). Liga/desliga
  campos do card e da coluna com **preview ao vivo** no board (grava o rascunho em
  `useKanbanStore.visibilityPreview`); Salvar persiste em
  `TrackingCardConfig.cardVisibility` via `useUpdateCardConfig`. Ver fluxo 7.5.
- `ai-lead-button/` — `AiLeadButton` (chat flutuante que usa `useTrackingAi`),
  `MessageTextPart` (parseia tokens `[VIEW_LEAD:name|id]`), `ViewLeadButton`,
  `constants.ts`, `types.ts`.

---

## 7. Fluxos principais

### 7.1 Drag & drop de um lead

1. `onDragStart` (BoardContainer): guarda `activeLead`, vizinhos originais e
   `activeDragLeadId`; remove o lead da seleção.
2. `onDragOver`: `moveLeadInColumn` / `moveLeadToColumn` no store → **UI otimista**.
3. `onDragEnd`:
   - Sobre uma drop-zone do `Footer` → abre modal de Ganho/Perda (`useLostOrWin`)
     ou exclusão (`useDeletLead`).
   - Caso normal → `calculateMidpoint` gera o novo `order` e `useUpdateLeadOrder`
     (`leads.updateNewOrder`) persiste. Erro → rollback via invalidação.
4. Servidor emite evento Pusher → `useBoardRealtimeSync` invalida nos outros
   clientes → refetch reconcilia o store (`registerColumn`).

### 7.2 Reorder de colunas

`moveColumn` no store (otimista) → `useUpdateColumnOrder` (`status.updateNewOrder`)
com snapshot/rollback → `status.getMany` revalida.

### 7.3 Ordenação e paginação

`SorterLead` muda `sortBy` → limpa `columns` → `useInfiniteLeadsByStatus` refaz o
fetch (cursor por `sortBy`). Scroll na coluna dispara `fetchNextPage`.

### 7.4 IA de leads

`AiLeadButton` → `useTrackingAi` → stream de `ia.tracking.chat`; tool calls
(`createLead`/`updateLead`/`moveLeadToStatus`) refletidas otimista no Kanban store.

### 7.5 Personalização de campos visíveis (por tracking)

1. Toolbar (`FiltersTracking`) mostra o botão **"Personalizar"** só quando
   `useCanCustomizeBoard` libera (Owner do tracking ou Owner/Admin da org).
2. `BoardCustomizeSheet` semeia o rascunho a partir de `cardVisibility` (config
   salvo). Cada `Switch` grava `visibilityPreview` no `useKanbanStore` → o board
   **atualiza ao vivo** (cards em `LeadItem`, contagem em `StatusLeadsCount`), pois
   ambos leem `visibilityPreview ?? cardVisibility` via `isFieldVisible`
   (`lib/card-visibility.ts`, default = visível). O Sheet agrupa os campos em
   dois accordions: **Card do lead** e **Colunas** (itera sobre `CARD_FIELDS`).
3. **Salvar** → `updateCardConfig` persiste `cardVisibility` (upsert em
   `TrackingCardConfig`) e limpa o preview. **Fechar sem salvar** limpa o preview
   → board volta ao estado salvo. O **nome do lead é sempre visível** (não é um
   toggle). O procedure valida a permissão server-side (Owner do tracking ou
   Owner/Admin da org).

**Campos toggláveis** (`CARD_FIELDS`) — `group: "card"`: `temperature`,
`nickname`, `phone`, `tags`, `description`, `purchaseBasket`, `aiIndicator`,
`dateLabel`, `slaTimer`, `conversation`, `forms`, `nextAppointment`, `deadline`,
`responsible`, **`leadValue`** (valor monetário do lead — `Lead.amount`, armazenado
em **centavos** e formatado com `maskMoney`, **oculto no card quando R$ 0,00**);
`group: "column"`: `leadCount`, **`columnValueTotal`** (soma dos `amount` da
coluna). O total vem de `status.getMany`, que faz `prisma.lead.groupBy` com
`_sum.amount` (mesmos filtros do `_count`) e expõe `valueTotal` por status; o
leaf `StatusValueTotal` (espelho de `StatusLeadsCount`) o renderiza no header.
Ao arrastar um lead entre colunas, `useOptimisticColumnValue` move o `amount`
(centavos) do total de origem para o de destino direto no cache de
`status.getMany` no drop — o header atualiza na hora, sem esperar o refetch;
`useUpdateLeadOrder` invalida `status.getMany` no sucesso (valor real do
servidor) e no erro (rollback).

> **Regra (CLAUDE.md item 16):** todo campo novo no card ou na coluna deve
> entrar em `CARD_FIELDS` (ganha toggle automático) e ser envolvido por
> `isFieldVisible(...)` no render — salvo campos obrigatórios (ex.: nome).

---

## 8. Procedures oRPC consumidas

Definidas fora desta feature (client apenas consome):

- **`tracking.*`** — `src/app/router/trackings/` (`list`, `listDashboard`,
  `get`, `create`, `update`, `delete`, `listParticipants`, `addParticipant`,
  `removeParticipant`, `getCardConfig`, `updateCardConfig`, `getKanbanAppearance`,
  `getCardAppearance`, `getLeadPurchases`, `getIdleAutomation`, `updateIdleAutomation`).
- **`leads.*`** — `src/app/router/leads/` (`listLeadsByStatus`, `updateNewOrder`,
  `updateManyStatus`, `addTags`, `removeTags`, `archive`, `delete`, `get`,
  `listHistoric`, `create-lead`, ...).
- **`status.*`** — `src/app/router/status/` (`getMany`, `updateNewOrder`,
  `create`, `update`, `delete`, ...).
- **`agenda.appointments.*`** — `src/app/router/agenda/appointments/`.
- **`ia.tracking.chat`** — `src/app/router/ia/ai-tracking/` (chat de IA + tools).
- **`tags.*`**, **`insights.*`** — invalidações/consumo cruzado.

---

## 9. Convenções e armadilhas

- **UI otimista + `isDragging`**: enquanto `isDragging`, `registerColumn` e
  `setColumnList` são no-ops — o refetch não sobrescreve o board no meio do arraste.
- **Diffing por `JSON.stringify`**: `registerColumn`/`setColumnList` comparam
  conteúdo antes de `set()` para não disparar loop de re-render ("Maximum update depth").
- **`order` fracionário (`Decimal`)**: nunca renumerar a coluna — sempre inserir na
  média dos vizinhos (`calculateMidpoint`).
- **Realtime coalescido**: invalidações agrupadas (250ms/2s) por status; a
  subscription desliga com a aba oculta.
- **Filtros vivem na URL** (`nuqs`), não no store — compartilháveis e persistentes
  ao refresh.
- **Typo consagrado**: `useQueryAppointmentsByTrackfing` ("Trackfing") existe
  duplicado em `use-trackings.ts` e `use-appointments.ts`.

---

## 10. Ver também

- [`docs/realtime-board-broadcast.md`](../../../docs/realtime-board-broadcast.md) — canal Pusher do board.
- [`docs/feature-formularios-tracking.md`](../../../docs/feature-formularios-tracking.md) — formulários/SLA por lead.
- [`CLAUDE.md`](../../../CLAUDE.md) (raiz) — arquitetura por features e regras de hooks/oRPC.
