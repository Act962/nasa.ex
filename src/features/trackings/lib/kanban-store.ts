import { Decimal } from "@prisma/client/runtime/client";
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { Lead } from "../types";
import { persist } from "zustand/middleware";

export type SortBy = "order" | "createdAt" | "updatedAt" | "statusEnteredAt";

type ColumnState = {
  id: string;
  leads: Lead[];
};

export const EMPTY_LEADS: Lead[] = [];

type KanbanStore = {
  columns: Record<string, ColumnState>;
  sortBy: SortBy;

  // Ações
  registerColumn: (columnId: string, leads: any[]) => void;
  setSortBy: (sortBy: SortBy) => void;
  moveLeadInColumn: (
    columnId: string,
    activeId: string,
    overId: string,
  ) => void;
  moveLeadToColumn: (
    activeId: string,
    activeColumnId: string,
    overColumnId: string,
    overId?: string,
  ) => void;

  findLeadColumn: (leadId: string) => string | undefined;

  getColumnLeads: (columnId: string) => Lead[];
  calculateMidpoint: (columnId: string, overLeadId?: string) => string;
  getLeadNeighbors: (
    columnId: string,
    leadId: string,
  ) => { beforeId?: string; afterId?: string };

  // Status/Colunas
  columnList: any[];
  setColumnList: (list: any[]) => void;
  moveColumn: (activeId: string, overId: string) => void;

  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;

  // Header colapsado — esconde TrackingSwitcher / Participantes / Tags /
  // Status / Calendário / IA de Leads, deixando apenas "Filtros" e
  // "Novo Lead". Persiste no localStorage pra manter preferência.
  headerCollapsed: boolean;
  toggleHeaderCollapsed: () => void;
};

export const useKanbanStore = create<KanbanStore>()(
  persist(
    (set, get) => ({
      columns: {},
      columnList: [],
      // Default: ordena pela data de entrada na etapa (mais recente em cima),
      // que casa com a data exibida no card por padrão. Usuários antigos com
      // sortBy persistido em "order" mantém preferência via Zustand persist.
      sortBy: "statusEnteredAt",
      isDragging: false,

      setIsDragging: (isDragging) => set({ isDragging }),

      headerCollapsed: false,
      toggleHeaderCollapsed: () =>
        set((state) => ({ headerCollapsed: !state.headerCollapsed })),

      setSortBy: (sortBy) =>
        set({
          sortBy,
          columns: {}, // limpa cache visual — React Query refaz o fetch
        }),

      setColumnList: (list) => {
        if (get().isDragging) return;
        const current = get().columnList;
        if (current === list) return;

        // Se o conjunto de IDs é o mesmo, preserva a ordem local (otimista)
        // e apenas atualiza as propriedades de cada coluna. Evita que uma
        // ordem antiga vinda do cache sobrescreva um reorder otimista
        // enquanto a mutação ainda está em voo.
        if (
          current.length === list.length &&
          current.length > 0 &&
          current.every((c) => list.some((l) => l.id === c.id))
        ) {
          const byId = new Map(list.map((l) => [l.id, l]));
          // Preserva o ref antigo quando o conteúdo da coluna é idêntico:
          // refetch da query traz objetos novos com mesmo conteúdo, e
          // re-renderizar StatusColumn cascateia em ScrollArea ref churn
          // (causa do "Maximum update depth").
          const merged = current.map((c) => {
            const incoming = byId.get(c.id);
            if (!incoming) return c;
            return JSON.stringify(c) === JSON.stringify(incoming)
              ? c
              : incoming;
          });
          const changed = merged.some((m, i) => m !== current[i]);
          if (changed) set({ columnList: merged });
          return;
        }

        set({ columnList: list });
      },

      moveColumn: (activeId, overId) => {
        set((state) => {
          const oldIndex = state.columnList.findIndex((c) => c.id === activeId);
          const newIndex = state.columnList.findIndex((c) => c.id === overId);

          if (oldIndex === -1 || newIndex === -1) return state;

          return {
            columnList: arrayMove(state.columnList, oldIndex, newIndex),
          };
        });
      },

      // ... (implementado abaixo)
      getLeadNeighbors: (columnId, leadId) => {
        const leads = get().columns[columnId]?.leads ?? [];
        const index = leads.findIndex((l) => l.id === leadId);

        if (index === -1) return {};

        return {
          beforeId: leads[index - 1]?.id,
          afterId: leads[index + 1]?.id,
        };
      },

      // Registra ou atualiza os leads de uma coluna (vindo do useInfiniteQuery)
      registerColumn: (columnId, leads) => {
        if (get().isDragging) return;

        const current = get().columns[columnId]?.leads;
        const next = leads ?? EMPTY_LEADS;

        if (current === next) return;

        // Compara conteúdo serializado: evita set() quando a query refetch
        // retornou nova referência mas dados idênticos (causa do loop de
        // re-render no drag). Captura mudanças em qualquer campo (description,
        // name, statusId, etc.) — essencial pra que edições de campo via
        // mutation cheguem ao Zustand store e ao LeadItem que sincroniza
        // estado local com data.description.
        const sameContent =
          !!current && JSON.stringify(current) === JSON.stringify(next);

        // Unicidade cross-column: leads presentes no snapshot DESTA coluna
        // não podem permanecer em outras colunas do store. Cobre o caso em
        // que uma automação move um lead A→B e a refetch de B chega antes da
        // refetch de A — sem este expurgo o lead aparece em ambas até a
        // refetch de A retornar (e em paginação infinita pode nunca retornar).
        const incomingIds = new Set(next.map((l: { id: string }) => l.id));

        set((state) => {
          const updatedColumns: Record<string, ColumnState> = { ...state.columns };
          let crossColumnChanged = false;

          for (const otherId of Object.keys(updatedColumns)) {
            if (otherId === columnId) continue;
            const other = updatedColumns[otherId];
            if (!other.leads.length) continue;
            const filtered = other.leads.filter((l) => !incomingIds.has(l.id));
            if (filtered.length !== other.leads.length) {
              updatedColumns[otherId] = { ...other, leads: filtered };
              crossColumnChanged = true;
            }
          }

          if (sameContent && !crossColumnChanged) return state;

          if (!sameContent) {
            updatedColumns[columnId] = { id: columnId, leads: next };
          }

          return { columns: updatedColumns };
        });
      },

      // Reordena leads dentro da mesma coluna (UI Otimista)
      moveLeadInColumn: (columnId, activeId, overId) => {
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return state;

          const oldIndex = column.leads.findIndex((l) => l.id === activeId);
          const newIndex = column.leads.findIndex((l) => l.id === overId);

          return {
            columns: {
              ...state.columns,
              [columnId]: {
                ...column,
                leads: arrayMove(column.leads, oldIndex, newIndex),
              },
            },
          };
        });
      },

      // Move um lead de uma coluna para outra (UI Otimista)
      moveLeadToColumn: (activeId, activeColumnId, overColumnId, overId) => {
        set((state) => {
          const sourceColumn = state.columns[activeColumnId];
          const destColumn = state.columns[overColumnId];

          if (!sourceColumn || !destColumn) return state;

          const activeLead = sourceColumn.leads.find((l) => l.id === activeId);
          if (!activeLead) return state;

          // 1. Remove da origem
          const newSourceLeads = sourceColumn.leads.filter(
            (l) => l.id !== activeId,
          );

          // 2. Insere no destino
          const newDestLeads = [...destColumn.leads];
          const overIndex = overId
            ? newDestLeads.findIndex((l) => l.id === overId)
            : -1;

          const updatedLead = { ...activeLead, statusId: overColumnId };

          if (overIndex >= 0) {
            newDestLeads.splice(overIndex, 0, updatedLead);
          } else {
            newDestLeads.push(updatedLead);
          }

          return {
            columns: {
              ...state.columns,
              [activeColumnId]: { ...sourceColumn, leads: newSourceLeads },
              [overColumnId]: { ...destColumn, leads: newDestLeads },
            },
          };
        });
      },

      getColumnLeads: (columnId) =>
        get().columns[columnId]?.leads ?? EMPTY_LEADS,

      findLeadColumn: (leadId) => {
        const state = get();
        return Object.keys(state.columns).find((colId) =>
          state.columns[colId].leads.some((l) => l.id === leadId),
        );
      },

      calculateMidpoint: (columnId, overLeadId) => {
        const leads = get().getColumnLeads(columnId);
        if (leads.length === 0) return "1000"; // Valor inicial generoso

        if (!overLeadId) {
          const last = leads[leads.length - 1];
          return new Decimal(last.order).plus(1000).toString();
        }

        const index = leads.findIndex((l) => l.id === overLeadId);
        const prev = leads[index - 1];
        const next = leads[index];

        if (!prev && next) {
          return new Decimal(next.order).minus(1000).toString();
        }
        if (prev && !next) {
          return new Decimal(prev.order).plus(1000).toString();
        }
        if (prev && next) {
          return new Decimal(prev.order).plus(next.order).div(2).toString();
        }

        return "1000";
      },
    }),
    {
      name: "kanban-store",
      partialize: (state) => ({
        sortBy: state.sortBy,
        headerCollapsed: state.headerCollapsed,
      }),
    },
  ),
);
