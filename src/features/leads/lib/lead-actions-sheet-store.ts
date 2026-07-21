import { create } from "zustand";
import { useActionKanbanStore } from "@/features/actions/lib/kanban-store";

type OpenLeadActionsPayload = {
  leadId: string;
  leadName: string;
  trackingId: string;
};

type LeadActionsSheetStore = {
  lead: OpenLeadActionsPayload | null;
  openLeadActions: (lead: OpenLeadActionsPayload) => void;
  closeLeadActions: () => void;
};

/**
 * Estado de abertura do sheet de ações do lead.
 *
 * Fica num store (e não em state por card) porque o sheet é montado UMA vez no
 * board: `LeadItem` é otimizado pra custo de render, e um `<Sheet>` por card
 * seriam centenas de portais Radix.
 *
 * Abrir e fechar zeram o board de ações — o kanban store é um singleton keyed
 * por columnId, e leads diferentes reusam os mesmos columnIds.
 */
export const useLeadActionsSheetStore = create<LeadActionsSheetStore>((set) => ({
  lead: null,
  openLeadActions: (lead) => {
    useActionKanbanStore.getState().resetBoard();
    set({ lead });
  },
  closeLeadActions: () => {
    useActionKanbanStore.getState().resetBoard();
    set({ lead: null });
  },
}));
