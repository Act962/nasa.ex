# Kanban — Ordenação Dinâmica de Leads

## Visão Geral

Adiciona suporte a três modos de ordenação no kanban:

| Valor       | Label              | Comportamento                       |
| ----------- | ------------------ | ----------------------------------- |
| `order`     | Personalizada      | Ordem do drag & drop (padrão atual) |
| `createdAt` | Data de criação    | Mais recente primeiro               |
| `updatedAt` | Última modificação | Mais recente primeiro               |

A seleção é **persistida no localStorage** via Zustand `persist`, por isso sobrevive a recarregamentos.

---

## Arquivos alterados

```
São os marcados
```

---

## 1. `kanban-store.ts`

### O que muda

- Adiciona tipo `SortBy`
- Adiciona campo `sortBy` e ação `setSortBy`
- Envolve o store com `persist` (persiste **só** `sortBy`)
- `setSortBy` limpa `columns` para evitar flash de ordem antiga

```ts
// Adicionar import
import { persist } from "zustand/middleware";

// Adicionar tipo
type SortBy = "order" | "createdAt" | "updatedAt";

// Adicionar na interface KanbanStore
sortBy: SortBy;
setSortBy: (sortBy: SortBy) => void;

// Adicionar no estado inicial
sortBy: "order",

// Adicionar ação
setSortBy: (sortBy) =>
  set({
    sortBy,
    columns: {}, // limpa cache visual — React Query refaz o fetch
  }),

// Envolver create com persist
export const useKanbanStore = create<KanbanStore>()(
  persist(
    (set, get) => ({
      // ... todo o conteúdo atual
    }),
    {
      name: "kanban-store",
      partialize: (state) => ({ sortBy: state.sortBy }),
    },
  ),
);
```

---

## 2. `use-trackings.ts` — hook de leads por status

### O que muda

- Lê `sortBy` do store
- Inclui `sortBy` na `queryKey` (React Query trata como cache separado)
- Passa `sortBy`, `cursorId` e `cursorValue` para o fetch

```ts
import { useKanbanStore } from "../lib/kanban-store";

export function useLeadsByStatus({
  statusId,
  trackingId,
}: {
  statusId: string;
  trackingId: string;
}) {
  const sortBy = useKanbanStore((state) => state.sortBy);

  return useInfiniteQuery({
    queryKey: ["leads", statusId, trackingId, sortBy], // ← sortBy aqui
    queryFn: ({ pageParam }) =>
      fetchLeadsByStatus({
        statusId,
        trackingId,
        sortBy,
        cursorId: pageParam?.cursorId,
        cursorValue: pageParam?.cursorValue,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.nextCursorId
        ? {
            cursorId: lastPage.nextCursorId,
            cursorValue: lastPage.nextCursorValue,
          }
        : undefined,
    initialPageParam: undefined,
  });
}
```

---

## 3. `board-container.tsx`

### O que muda

- Lê `sortBy` do store
- Ignora drop de leads quando `sortBy !== "order"` (não faz sentido salvar ordem manual sobre ordenação por data)

```tsx
// Adicionar no topo do componente
const sortBy = useKanbanStore((state) => state.sortBy);

// Dentro de onDragEnd, logo após os sets iniciais
function onDragEnd(event: DragEndEvent) {
  const { active, over } = event;

  setActiveColumn(null);
  setActiveLead(null);

  if (!over) return;

  const activeType = active.data.current?.type;

  // ← ADICIONAR: bloqueia reordenação de leads fora do modo manual
  if (activeType === "Lead" && sortBy !== "order") return;

  // ... resto do código original sem alterações
}
```

---

## 4. `sort-by-selector.tsx` — novo componente

Criar arquivo em `components/sort-by-selector.tsx`:

```tsx
"use client";

import { useKanbanStore } from "../lib/kanban-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown } from "lucide-react";

const OPTIONS = [
  { value: "order", label: "Personalizada" },
  { value: "createdAt", label: "Data de criação" },
  { value: "updatedAt", label: "Última modificação" },
] as const;

type SortBy = (typeof OPTIONS)[number]["value"];

export function SortBySelector() {
  const sortBy = useKanbanStore((state) => state.sortBy);
  const setSortBy = useKanbanStore((state) => state.setSortBy);

  return (
    <Select
      value={sortBy}
      onValueChange={(value) => setSortBy(value as SortBy)}
    >
      <SelectTrigger className="w-48 gap-2">
        <ArrowUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## 5. `nav-options-tracking.tsx`

### O que muda

- Importa e renderiza `<SortBySelector />`

```tsx
import { SortBySelector } from "./sort-by-selector";

// Adicionar dentro do JSX onde ficam os controles da navbar
<SortBySelector />;
```

---

## 6. `list-leads-by-status.ts` — rota da API

### O que muda

- Aceita `sortBy`, `cursorId` e `cursorValue` no input
- Monta `orderBy` dinamicamente
- Cursor composto no `where` (evita duplicatas com timestamps iguais)
- Retorna `nextCursorId` e `nextCursorValue`

```ts
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

const sortOptions = z.enum(["order", "createdAt", "updatedAt"]);
type SortOption = z.infer<typeof sortOptions>;

function buildOrderBy(sortBy: SortOption) {
  const map: Record<SortOption, object[]> = {
    order: [{ order: "asc" }, { id: "asc" }],
    createdAt: [{ createdAt: "desc" }, { id: "asc" }],
    updatedAt: [{ updatedAt: "desc" }, { id: "asc" }],
  };
  return map[sortBy];
}

function buildCursorWhere(
  sortBy: SortOption,
  cursorId?: string,
  cursorValue?: string,
) {
  if (!cursorId || !cursorValue) return {};

  if (sortBy === "createdAt") {
    return {
      OR: [
        { createdAt: { lt: new Date(cursorValue) } },
        { createdAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  if (sortBy === "updatedAt") {
    return {
      OR: [
        { updatedAt: { lt: new Date(cursorValue) } },
        { updatedAt: new Date(cursorValue), id: { gt: cursorId } },
      ],
    };
  }

  // order (Decimal asc)
  return {
    OR: [
      { order: { gt: Number(cursorValue) } },
      { order: Number(cursorValue), id: { gt: cursorId } },
    ],
  };
}

export const listLeadsByStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List leads by status with cursor pagination",
    tags: ["Leads"],
  })
  .input(
    z.object({
      statusId: z.string(),
      trackingId: z.string(),
      sortBy: sortOptions.default("order"), // ← novo
      cursorId: z.string().optional(), // ← substituem cursor
      cursorValue: z.string().optional(), // ← substituem cursor
      limit: z.number().min(1).max(100).default(50),
      dateInit: z.string().optional(),
      dateEnd: z.string().optional(),
      participantFilter: z.string().optional(),
      tagsFilter: z.array(z.string()).optional(),
      temperatureFilter: z.array(z.string()).optional(),
      actionFilter: z.enum(["ACTIVE", "WON", "LOST", "DELETED"]).optional(),
    }),
  )
  .handler(async ({ input }) => {
    const {
      statusId,
      trackingId,
      sortBy,
      cursorId,
      cursorValue,
      limit,
      dateInit,
      dateEnd,
      participantFilter,
      tagsFilter,
      temperatureFilter,
      actionFilter,
    } = input;

    const leads = await prisma.lead.findMany({
      where: {
        statusId,
        trackingId,
        currentAction: actionFilter || "ACTIVE",
        ...buildCursorWhere(sortBy, cursorId, cursorValue), // ← cursor composto
        ...(dateInit &&
          dateEnd && {
            createdAt: { gte: new Date(dateInit), lte: new Date(dateEnd) },
          }),
        ...(participantFilter && {
          responsible: { email: participantFilter },
        }),
        ...(tagsFilter &&
          tagsFilter.length > 0 && {
            leadTags: { some: { tag: { slug: { in: tagsFilter } } } },
          }),
        ...(temperatureFilter &&
          temperatureFilter.length > 0 && {
            temperature: { in: temperatureFilter as any },
          }),
      },
      orderBy: buildOrderBy(sortBy), // ← ordenação dinâmica
      take: limit + 1,
      select: {
        id: true,
        isActive: true,
        name: true,
        email: true,
        phone: true,
        order: true,
        statusId: true,
        createdAt: true,
        updatedAt: true, // ← adicionar
        temperature: true,
        profile: true,
        responsible: { select: { image: true, name: true } },
        leadTags: {
          select: {
            tag: { select: { id: true, name: true, color: true, slug: true } },
          },
        },
      },
    });

    let nextCursorId: string | undefined;
    let nextCursorValue: string | undefined;

    if (leads.length > limit) {
      leads.pop();
      const last = leads[leads.length - 1];
      nextCursorId = last.id;
      nextCursorValue =
        sortBy === "order" ? last.order.toString() : last[sortBy].toISOString();
    }

    return {
      leads: leads.map((lead) => ({
        ...lead,
        order: lead.order.toString(),
      })),
      nextCursorId,
      nextCursorValue,
    };
  });
```

---

## Fluxo completo

```
usuário seleciona "Data de criação"
  → setSortBy("createdAt")
    → columns: {}             — limpa visual imediatamente
    → queryKey muda           — React Query detecta nova key
      → fetch com sortBy=createdAt, sem cursor
        → API retorna leads ordenados por createdAt desc
          → registerColumn popula columns
            → colunas renderizam na nova ordem
              → drag & drop desabilitado para leads
```

---

## Checklist de implementação

- [ ] `kanban-store.ts` — adicionar `SortBy`, `sortBy`, `setSortBy`, `persist`
- [ ] `use-trackings.ts` — `sortBy` na queryKey e no fetch
- [ ] `board-container.tsx` — bloquear drag de leads quando `sortBy !== "order"`
- [ ] `sort-by-selector.tsx` — criar componente
- [ ] `nav-options-tracking.tsx` — montar `<SortBySelector />`
- [ ] `list-leads-by-status.ts` — `sortBy`, cursor composto, `updatedAt` no select
