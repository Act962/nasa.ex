import { create } from "zustand";

type Type = "WIN" | "LOSS";

type lostOwWinStore = {
  id?: string;
  isOpen: boolean;
  onOpen: (id: string, type: Type) => void;
  onClose: () => void;
  type: Type;
};

export const useLostOrWin = create<lostOwWinStore>((set) => ({
  id: undefined,
  isOpen: false,
  onOpen: (id: string, type: Type) => set({ isOpen: true, id, type }),
  onClose: () => set({ isOpen: false, id: undefined }),
  type: "LOSS",
}));
