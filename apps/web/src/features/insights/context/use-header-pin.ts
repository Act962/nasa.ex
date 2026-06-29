import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HeaderPinState {
  isPinned: boolean;
  toggle: () => void;
  setPinned: (pinned: boolean) => void;
}

export const useHeaderPin = create<HeaderPinState>()(
  persist(
    (set) => ({
      isPinned: true,
      toggle: () => set((s) => ({ isPinned: !s.isPinned })),
      setPinned: (pinned) => set({ isPinned: pinned }),
    }),
    { name: "insights-header-pin" },
  ),
);
