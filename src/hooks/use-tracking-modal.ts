import { create } from "zustand";

type TrackingModalStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useTracking = create<TrackingModalStore>((set, get) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
