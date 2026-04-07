export interface Shortcut {
  keys: string[];
  keysWin?: string[];
  description: string;
  category: string;
  action?: string;
}

export const SHORTCUTS: Shortcut[] = [
  // Navegação
  {
    keys: ["⌘", "A"],
    keysWin: ["Ctrl", "A"],
    description: "Abrir NASA Explorer (foco no campo de comando)",
    category: "Navegação",
    action: "open_explorer",
  },
  {
    keys: ["⌘", "B"],
    keysWin: ["Ctrl", "B"],
    description: "Alternar barra lateral",
    category: "Navegação",
    action: "toggle_sidebar",
  },
  {
    keys: ["⌘", "K"],
    keysWin: ["Ctrl", "K"],
    description: "Abrir busca rápida",
    category: "Navegação",
    action: "open_search",
  },
  // Apps
  {
    keys: ["⌘", "T"],
    keysWin: ["Ctrl", "T"],
    description: "Ir para Tracking",
    category: "Apps",
    action: "goto_tracking",
  },
  {
    keys: ["⌘", "F"],
    keysWin: ["Ctrl", "F"],
    description: "Ir para FORGE",
    category: "Apps",
    action: "goto_forge",
  },
  {
    keys: ["⌘", "W"],
    keysWin: ["Ctrl", "W"],
    description: "Ir para Workspace",
    category: "Apps",
    action: "goto_workspace",
  },
  {
    keys: ["⌘", "J"],
    keysWin: ["Ctrl", "J"],
    description: "Ir para Chat",
    category: "Apps",
    action: "goto_chat",
  },
  {
    keys: ["⌘", "G"],
    keysWin: ["Ctrl", "G"],
    description: "Ir para Agendas",
    category: "Apps",
    action: "goto_agenda",
  },
  // Interface
  {
    keys: ["⌘", "Shift", "A"],
    keysWin: ["Ctrl", "Shift", "A"],
    description: "Abrir / fechar ASTRO",
    category: "Interface",
    action: "toggle_astro",
  },
  {
    keys: ["Esc"],
    description: "Fechar modal / dropdown aberto",
    category: "Interface",
    action: "escape",
  },
];
