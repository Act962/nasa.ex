import { create } from "zustand";

type AddLeadSheetStore = {
  isOpen: boolean;
  onOpen: (trackingId: string) => void;
  onClose: () => void;
  trackingId?: string;
};

export const useAddLead = create<AddLeadSheetStore>((set) => ({
  isOpen: false,
  onOpen: (trackingId: string) => set({ isOpen: true, trackingId }),
  onClose: () => set({ isOpen: false, trackingId: undefined }),
  trackingId: undefined,
}));
