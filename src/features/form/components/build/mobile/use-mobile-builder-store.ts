"use client";

import { create } from "zustand";

/** Gavetas do construtor no celular: blocos, edição do bloco, ajustes e prévia. */

export type MobileBuilderPanel = "add-block" | "edit-block" | "settings" | "preview" | null;

interface MobileBuilderStore {
  openPanel: MobileBuilderPanel;
  setOpenPanel: (panel: MobileBuilderPanel) => void;
}

export const useMobileBuilderStore = create<MobileBuilderStore>()((set) => ({
  openPanel: null,
  setOpenPanel: (openPanel) => set({ openPanel }),
}));
