import { create } from "zustand";

export interface Lead {
  id: string;
  name?: string;
  phone?: string;
}

type LeadStore = {
  lead: Lead | null;
  setLead: (lead: Lead) => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useLeads = create<LeadStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => {
    set({ isOpen: false });

    setTimeout(() => {
      set({ lead: null });
    }, 200);
  },
  lead: null,
  setLead: (lead) => set({ lead }),
}));
