import { create } from "zustand";

type MemberStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useMemberModal = create<MemberStore>((set, get) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
