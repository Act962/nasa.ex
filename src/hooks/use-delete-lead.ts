import { create } from "zustand";

export type LeadToDelete = {
  id: string;
  name: string;
};

type DeleteLeadStore = {
  leads: LeadToDelete[];
  isOpen: boolean;
  onDone?: () => void;
  onOpen: (leads: LeadToDelete[], onDone?: () => void) => void;
  onClose: () => void;
};

export const useDeletLead = create<DeleteLeadStore>((set) => ({
  leads: [],
  isOpen: false,
  onDone: undefined,
  onOpen: (leads, onDone) => set({ leads, isOpen: true, onDone }),
  onClose: () => set({ isOpen: false, leads: [], onDone: undefined }),
}));
