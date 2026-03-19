import { Decimal } from "@prisma/client/runtime/client";
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";
import { Lead } from "../types";
import { persist } from "zustand/middleware";

type SortBy = "order" | "createdAt" | "updatedAt";

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
};

export const useKanbanStore = create<KanbanStore>()(
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
          columns: {}, // limpa cache visual — React Query refaz o fetch
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

        const currentLeads = get().columns[columnId]?.leads;

        // Se ambos forem iguais por referência, não faz nada
        if (currentLeads === leads) return;

        // Se a quantidade for a mesma, verifica se os leads são os mesmos (mesmo se em ordem diferente)
        if (currentLeads && leads && currentLeads.length === leads.length) {
          // Verifica se todos os objetos de lead na store estão presentes nos leads vindos da query
          // Isso permite que reordenações otimistas sejam preservadas enquanto a query ainda tem os dados antigos
          const isSameContent = currentLeads.every((l) =>
            leads.some((incoming) => incoming.id === l.id),
          );

          if (isSameContent) {
            return;
          }
        }

        set((state) => ({
          columns: {
            ...state.columns,
            [columnId]: { id: columnId, leads: leads ?? EMPTY_LEADS },
          },
        }));
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
      partialize: (state) => ({ sortBy: state.sortBy }),
    },
  ),
);
