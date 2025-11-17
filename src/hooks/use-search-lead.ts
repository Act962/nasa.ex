import { create } from "zustand";

type UseSeachLead = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useSearchLead = create<UseSeachLead>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
