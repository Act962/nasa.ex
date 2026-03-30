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
  calculateMidpoint: (columnId: string, activeId: string) => string;
  getActionNeighbors: (
    columnId: string,
    actionId: string,
  ) => { beforeId?: string; afterId?: string };

  // Status/Columns
  columnList: any[];
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
        if (get().columnList === list) return;
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

        const currentActions = get().columns[columnId]?.actions;

        if (currentActions === actions) return;

        set((state) => ({
          columns: {
            ...state.columns,
            [columnId]: { id: columnId, actions: actions ?? EMPTY_ACTIONS },
          },
        }));
      },

      moveActionInColumn: (columnId, activeId, overId) => {
        set((state) => {
          const column = state.columns[columnId];
          if (!column) return state;

          const oldIndex = column.actions.findIndex((l) => l.id === activeId);
          const newIndex = column.actions.findIndex((l) => l.id === overId);

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

      findActionColumn: (actionId) => {
        const state = get();
        return Object.keys(state.columns).find((colId) =>
          state.columns[colId].actions.some((l) => l.id === actionId),
        );
      },

      calculateMidpoint: (columnId, activeId) => {
        const actions = get().getColumnActions(columnId);
        if (actions.length === 0) return "1000";

        const index = actions.findIndex((l) => l.id === activeId);
        
        // If not found in target column (drag failed or not moved yet), 
        // put it at the end of the target column as a safe fallback
        if (index === -1) {
          const last = actions[actions.length - 1];
          return last ? new Decimal(last.order).plus(1000).toString() : "1000";
        }

        const prev = actions[index - 1];
        const next = actions[index + 1];

        // Case 1: Only item in the column
        if (!prev && !next) return "1000";
        
        // Case 2: Very first item (has next, no prev)
        if (!prev && next) {
          return new Decimal(next.order ?? "0").minus(1000).toString();
        }
        
        // Case 3: Very last item (has prev, no next)
        if (prev && !next) {
          return new Decimal(prev.order ?? "0").plus(1000).toString();
        }
        
        // Case 4: Between two items
        if (prev && next) {
          return new Decimal(prev.order ?? "0").plus(next.order ?? "0").div(2).toString();
        }

        return "1000";
      },
    }),
    {
      name: "action-kanban-store",
      partialize: (state) => ({ sortBy: state.sortBy }),
    },
  ),
);
