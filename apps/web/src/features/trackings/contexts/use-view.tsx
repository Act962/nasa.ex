import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "default" | "modern";

interface ViewState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

export const useView = create<ViewState>()(
  persist(
    (set) => ({
      viewMode: "default",
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: "lead-card-view-mode", // Nome da chave no localStorage
    },
  ),
);
