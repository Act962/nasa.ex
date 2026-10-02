"use client";

import { create } from "zustand";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";

interface LeadDetailsState {
  isMobileOpen: boolean;
  setIsMobileOpen: (isOpen: boolean) => void;
  /** Coluna lateral recolhida no desktop (preferência salva no navegador pela própria coluna). */
  isDesktopCollapsed: boolean;
  setIsDesktopCollapsed: (isCollapsed: boolean) => void;
  /** Nome ou foto do lead no cabeçalho: tela cheia no celular, coluna aberta no desktop. */
  requestOpen: () => void;
}

export const useLeadDetailsStore = create<LeadDetailsState>()((set) => ({
  isMobileOpen: false,
  setIsMobileOpen: (isOpen) => set({ isMobileOpen: isOpen }),
  isDesktopCollapsed: true,
  setIsDesktopCollapsed: (isCollapsed) => set({ isDesktopCollapsed: isCollapsed }),
  requestOpen: () => {
    if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) {
      set({ isDesktopCollapsed: false });
      return;
    }
    set({ isMobileOpen: true });
  },
}));
