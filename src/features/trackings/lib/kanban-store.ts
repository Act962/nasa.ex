import { Decimal } from "@prisma/client/runtime/client";
import { create } from "zustand";
import { arrayMove } from "@dnd-kit/sortable";

type Lead = {
  order: string;
  id: string;
  email: string | null;
  name: string;
  profile: string | null;
  statusId: string;
  createdAt: Date;
  phone: string | null;
  responsible: {
    image: string | null;
    name: string;
  } | null;
};

type ColumnState = {
  id: string;
  leads: Lead[];
};

export const EMPTY_LEADS: Lead[] = [];

type KanbanStore = {
  columns: Record<string, ColumnState>;

  // Ações
  registerColumn: (columnId: string, leads: any[]) => void;
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
};

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  columns: {},
  columnList: [],

  setColumnList: (list) => set({ columnList: list }),

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
    // const currentLeads = get().columns[columnId]?.leads;

    // // ❌ Remova esta verificação problemática
    // // if (currentLeads === leads) return;

    // // ✅ Compare apenas por tamanho E IDs
    // if (currentLeads && leads) {
    //   if (currentLeads.length !== leads.length) {
    //     // Tamanho diferente = atualiza
    //     set((state) => ({
    //       columns: {
    //         ...state.columns,
    //         [columnId]: { id: columnId, leads },
    //       },
    //     }));
    //     return;
    //   }

    //   // Mesma quantidade: verifica se todos os IDs são iguais
    //   const sameIds = currentLeads.every(
    //     (current, idx) => current.id === leads[idx]?.id,
    //   );

    //   if (sameIds) return; // Mesmos IDs na mesma ordem = não atualiza
    // }

    // // Atualiza o store
    // set((state) => ({
    //   columns: {
    //     ...state.columns,
    //     [columnId]: { id: columnId, leads },
    //   },
    // }));
    const currentLeads = get().columns[columnId]?.leads;

    // Comparação de referência simples se ambos existirem
    if (currentLeads === leads) return;

    // Se o tamanho for diferente, com certeza mudou
    if (currentLeads && leads && currentLeads.length === leads.length) {
      // Verifica se pelo menos o primeiro e o último mudaram (heurística rápida)
      if (
        currentLeads[0]?.id === leads[0]?.id &&
        currentLeads[currentLeads.length - 1]?.id ===
          leads[leads.length - 1]?.id
      ) {
        return;
      }
    }

    set((state) => ({
      columns: {
        ...state.columns,
        [columnId]: { id: columnId, leads },
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

  getColumnLeads: (columnId) => get().columns[columnId]?.leads ?? EMPTY_LEADS,

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
}));
