"use client";

import { useEffect } from "react";
import { create } from "zustand";
import type { OrbitDockItem } from "./orbit-dock";

/** Itens do dock definidos pela tela atual; sem registro, o host usa a navegação padrão. */

export interface OrbitDockConfig {
  leftItems: [OrbitDockItem, OrbitDockItem];
  rightItems: [OrbitDockItem, OrbitDockItem];
  /** Ação no centro do arco no lugar do ASTRO (ex.: "+ Bloco" no construtor de formulários). */
  centerAction?: OrbitDockItem;
}

interface OrbitDockState {
  config: OrbitDockConfig | null;
  setConfig: (config: OrbitDockConfig | null) => void;
  isHidden: boolean;
  setIsHidden: (isHidden: boolean) => void;
  /** Rolou a tela para baixo: o dock desce e fica só a metade de cima da bola do centro. */
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

export const useOrbitDockStore = create<OrbitDockState>()((set) => ({
  config: null,
  setConfig: (config) => set({ config }),
  isHidden: false,
  setIsHidden: (isHidden) => set({ isHidden }),
  isCollapsed: false,
  setIsCollapsed: (isCollapsed) => set((state) => (state.isCollapsed === isCollapsed ? state : { isCollapsed })),
}));

export function useRegisterOrbitDock(config: OrbitDockConfig) {
  const setConfig = useOrbitDockStore((state) => state.setConfig);

  useEffect(() => {
    setConfig(config);
  });

  useEffect(() => () => setConfig(null), [setConfig]);
}

/** Esconde o dock (e o orb do ASTRO encaixado nele) enquanto a tela estiver aberta, ex.: conversa do Chat. */
export function useHideOrbitDock() {
  const setIsHidden = useOrbitDockStore((state) => state.setIsHidden);

  useEffect(() => {
    setIsHidden(true);
    return () => setIsHidden(false);
  }, [setIsHidden]);
}
