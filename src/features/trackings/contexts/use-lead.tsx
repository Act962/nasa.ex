import { create } from "zustand";
import { Lead } from "../types";

interface LeadStore {
  selectedLeads: Lead[];
  addLead: (lead: Lead) => void;
  removeLead: (leadId: string) => void;
  toggleLead: (lead: Lead) => void;
  clearSelection: () => void;
  isSelected: (leadId: string) => boolean;
}

export const useLeadStore = create<LeadStore>((set, get) => ({
  selectedLeads: [],
  addLead: (lead) =>
    set((state) => ({
      selectedLeads: [...state.selectedLeads, lead],
    })),
  removeLead: (leadId) =>
    set((state) => ({
      selectedLeads: state.selectedLeads.filter((l) => l.id !== leadId),
    })),
  toggleLead: (lead) => {
    const isSelected = get().selectedLeads.some((l) => l.id === lead.id);
    if (isSelected) {
      get().removeLead(lead.id);
    } else {
      get().addLead(lead);
    }
  },
  clearSelection: () => set({ selectedLeads: [] }),
  isSelected: (leadId) => get().selectedLeads.some((l) => l.id === leadId),
}));
