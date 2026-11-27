import { create } from "zustand";

type Type = "WIN" | "LOSS";

type LostOrWinStore = {
  leadIds: string[];
  isOpen: boolean;
  type: Type;
  onDone?: () => void;
  onOpen: (leadIds: string[], type: Type, onDone?: () => void) => void;
  onClose: () => void;
};

export const useLostOrWin = create<LostOrWinStore>((set) => ({
  leadIds: [],
  isOpen: false,
  type: "LOSS",
  onDone: undefined,
  onOpen: (leadIds, type, onDone) =>
    set({ isOpen: true, leadIds, type, onDone }),
  onClose: () => set({ isOpen: false, leadIds: [], onDone: undefined }),
}));
