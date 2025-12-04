import { create } from "zustand";

type leadsDeletModal = {
  id: string;
  name: string;
} | null;

type deletLeadType = {
  lead: leadsDeletModal;
  isOpen: boolean;
  onOpen: (idLead: leadsDeletModal) => void;
  onClose: () => void;
};

export const useDeletLead = create<deletLeadType>((set) => ({
  lead: null,
  isOpen: false,
  onOpen: (idLead: leadsDeletModal) => set({ lead: idLead, isOpen: true }),
  onClose: () => set({ isOpen: false, lead: null }),
}));
