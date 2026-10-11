import { create } from "zustand";

// Janela da central de Gatilhos Automáticos (spec 0090, RF-1). Um estado só para a plataforma:
// qualquer botão abre a mesma janela.

export type AutomationsHubTab = "new" | "active";

interface AutomationsHubState {
  isOpen: boolean;
  tab: AutomationsHubTab;
  open: (tab?: AutomationsHubTab) => void;
  close: () => void;
  setTab: (tab: AutomationsHubTab) => void;
}

export const useAutomationsHubStore = create<AutomationsHubState>()((set) => ({
  isOpen: false,
  tab: "active",
  open: (tab = "active") => set({ isOpen: true, tab }),
  close: () => set({ isOpen: false }),
  setTab: (tab) => set({ tab }),
}));
