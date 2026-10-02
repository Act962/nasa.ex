"use client";

import { create } from "zustand";

/** Gaveta aberta no editor do celular (no computador os painéis ficam nas laterais). */
export type BuilderMobilePanel = "add" | "layers" | "pages" | "properties" | "settings";

interface BuilderMobilePanelState {
  openPanel: BuilderMobilePanel | null;
  setOpenPanel: (panel: BuilderMobilePanel | null) => void;
}

export const useBuilderMobilePanelStore = create<BuilderMobilePanelState>()((set) => ({
  openPanel: null,
  setOpenPanel: (panel) => set({ openPanel: panel }),
}));
