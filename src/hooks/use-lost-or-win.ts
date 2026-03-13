import { create } from "zustand";

type Type = "WIN" | "LOSS";

type lostOwWinStore = {
  fields?: {
    leadId: string;
    trackingId: string;
  };
  isOpen: boolean;
  onOpen: (
    fields: {
      leadId: string;
      trackingId: string;
    },
    type: Type,
  ) => void;
  onClose: () => void;
  type: Type;
};

export const useLostOrWin = create<lostOwWinStore>((set) => ({
  id: undefined,
  isOpen: false,
  onOpen: (
    fields: {
      leadId: string;
      trackingId: string;
    },
    type: Type,
  ) => set({ isOpen: true, fields, type }),
  onClose: () => set({ isOpen: false, fields: undefined }),
  type: "LOSS",
}));
