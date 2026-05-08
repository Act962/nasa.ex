import { Decimal } from "@prisma/client/runtime/client";
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { Action } from "../types";
import { persist } from "zustand/middleware";

type SortBy = "order" | "createdAt" | "updatedAt";

type ColumnState = {
  id: string;
  actions: Action[];
};

export const EMPTY_ACTIONS: Action[] = [];

type ActionKanbanStore = {
  columns: Record<string, ColumnState>;
  sortBy: SortBy;

  // Actions
  registerColumn: (columnId: string, actions: any[]) => void;
  setSortBy: (sortBy: SortBy) => void;
  moveActionInColumn: (
    columnId: string,
    activeId: string,
    overId: string,
  ) => void;
  moveActionToColumn: (
    activeId: string,
    activeColumnId: string,
    overColumnId: string,
    overId?: string,
  ) => void;

  findActionColumn: (actionId: string) => string | undefined;

  getColumnActions: (columnId: string) => Action[];
  getActionNeighbors: (
    columnId: string,
    actionId: string,
  ) => { beforeId?: string; afterId?: string };

  // Status/Columns
  columnList: any[];
  getColumnNeighbors: (columnId: string) => { beforeId?: string; afterId?: string };
  setColumnList: (list: any[]) => void;
  moveColumn: (activeId: string, overId: string) => void;

  isDragging: boolean;
  setIsDragging: (isDragging: boolean) => void;
};

export const useActionKanbanStore = create<ActionKanbanStore>()(
  persist(
    (set, get) => ({
      columns: {},
      columnList: [],
      sortBy: "order",
      isDragging: false,

      setIsDragging: (isDragging) => set({ isDragging }),

      setSortBy: (sortBy) =>
        set({
          sortBy,
          columns: {}, // clear visual cache
        }),

      setColumnList: (list) => {
        if (get().isDragging) return;
        const current = get().columnList;
        if (current === list) return;

        // Quando o conjunto de IDs é o mesmo, preserva o ref antigo de cada
        // coluna cujo conteúdo é idêntico ao incoming. Refetch traz objetos
        // novos com mesmo conteúdo, e re-renderizar WorkspaceColumn cascateia
        // em ScrollArea ref churn (causa do "Maximum update depth").
        if (
          current.length === list.length &&
          current.length > 0 &&
          current.every((c) => list.some((l) => l.id === c.id))
        ) {
          const byId = new Map(list.map((l) => [l.id, l]));
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

      getActionNeighbors: (columnId, actionId) => {
        const actions = get().columns[columnId]?.actions ?? [];
        const index = actions.findIndex((l) => l.id === actionId);

        if (index === -1) return {};

        return {
          beforeId: actions[index - 1]?.id,
          afterId: actions[index + 1]?.id,
        };
      },

      registerColumn: (columnId, actions) => {
        if (get().isDragging) return;

        const current = get().columns[columnId]?.actions;
        const next = actions ?? EMPTY_ACTIONS;

        if (current === next) return;

        // Compara conteúdo serializado: evita set() quando a query refetch
        // retornou nova referência mas dados idênticos (causa do loop de
        // re-render no drag). Captura mudanças em qualquer campo — essencial
        // para que edições de title/description via mutation cheguem ao
        // Zustand store e a componentes filhos que sincronizam state com props.
        if (current && JSON.stringify(current) === JSON.stringify(next)) return;

        set((state) => ({
          columns: {
            ...state.columns,
            [columnId]: { id: columnId, actions: next },
          },
        }));
      },

      moveActionInColumn: (columnId, activeId, overId) => {
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return state;

          const oldIndex = column.actions.findIndex((l) => l.id === activeId);
          const newIndex = column.actions.findIndex((l) => l.id === overId);

          if (oldIndex === -1 || newIndex === -1) return state;

          return {
            columns: {
              ...state.columns,
              [columnId]: {
                ...column,
                actions: arrayMove(column.actions, oldIndex, newIndex),
              },
            },
          };
        });
      },

      moveActionToColumn: (activeId, activeColumnId, overColumnId, overId) => {
        set((state) => {
          const sourceColumn = state.columns[activeColumnId];
          const destColumn = state.columns[overColumnId];

          if (!sourceColumn || !destColumn) return state;

          const activeAction = sourceColumn.actions.find((l) => l.id === activeId);
          if (!activeAction) return state;

          const newSourceActions = sourceColumn.actions.filter(
            (l) => l.id !== activeId,
          );

          const newDestActions = [...destColumn.actions];
          const overIndex = overId
            ? newDestActions.findIndex((l) => l.id === overId)
            : -1;

          const updatedAction = { ...activeAction, columnId: overColumnId };

          if (overIndex >= 0) {
            newDestActions.splice(overIndex, 0, updatedAction);
          } else {
            newDestActions.push(updatedAction);
          }

          const newColumnList = state.columnList.map((col) => {
            if (col.id === activeColumnId) {
              return { ...col, actionsCount: Math.max(0, (col.actionsCount || 0) - 1) };
            }
            if (col.id === overColumnId) {
              return { ...col, actionsCount: (col.actionsCount || 0) + 1 };
            }
            return col;
          });

          return {
            columnList: newColumnList,
            columns: {
              ...state.columns,
              [activeColumnId]: { ...sourceColumn, actions: newSourceActions },
              [overColumnId]: { ...destColumn, actions: newDestActions },
            },
          };
        });
      },

      getColumnActions: (columnId) =>
        get().columns[columnId]?.actions ?? EMPTY_ACTIONS,

      findActionColumn: (actionId: string) => {
        const state = get();
        return Object.keys(state.columns).find((colId) =>
          state.columns[colId].actions.some((l) => l.id === actionId),
        );
      },

      getColumnNeighbors: (columnId: string) => {
        const columns = get().columnList;
        const index = columns.findIndex((c) => c.id === columnId);

        if (index === -1) return {};

        return {
          beforeId: columns[index - 1]?.id,
          afterId: columns[index + 1]?.id,
        };
      },
    }),
    {
      name: "action-kanban-store",
      partialize: (state) => ({ sortBy: state.sortBy }),
    },
  ),
);
