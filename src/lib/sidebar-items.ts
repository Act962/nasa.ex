import {
  Calendar,
  ChartColumnDecreasingIcon,
  CircleCheckIcon,
  ClipboardType,
  Kanban,
  LayoutGrid,
  MessageSquareTextIcon,
  Plug2,
  Users,
  FolderOpen,
  Map,
  Hammer,
  Landmark,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";

export interface SidebarNavItem {
  key:           string;
  title:         string;
  url:           string;
  icon:          LucideIcon | React.FC<{ className?: string }>;
  alwaysVisible: boolean;
  defaultVisible: boolean; // visível por padrão se não houver preferência salva
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  // ── Visíveis por padrão ──────────────────────────────────────────────────
  { key: "tracking",     title: "Trackings",    url: "/tracking",       icon: Kanban,                    alwaysVisible: false, defaultVisible: true  },
  { key: "workspaces",   title: "Workspaces",   url: "/workspaces",     icon: CircleCheckIcon,           alwaysVisible: false, defaultVisible: true  },
  { key: "cosmic",       title: "Formulários",  url: "/form",           icon: ClipboardType,             alwaysVisible: false, defaultVisible: true  },
  { key: "nasachat",     title: "Chats",        url: "/tracking-chat",  icon: MessageSquareTextIcon,     alwaysVisible: false, defaultVisible: true  },
  { key: "spacetime",    title: "Agenda",       url: "/agendas",        icon: Calendar,                  alwaysVisible: false, defaultVisible: true  },
  { key: "contatos",     title: "Contatos",     url: "/contatos",       icon: Users,                     alwaysVisible: false, defaultVisible: true  },
  { key: "insights",     title: "Insights",     url: "/insights",       icon: ChartColumnDecreasingIcon, alwaysVisible: false, defaultVisible: true  },
  { key: "integrations", title: "Integrações",  url: "/integrations",   icon: Plug2,                     alwaysVisible: false, defaultVisible: true  },
  // ── Ocultos por padrão (opt-in) ──────────────────────────────────────────
  { key: "nbox",         title: "N-Box",        url: "/nbox",           icon: FolderOpen,                alwaysVisible: false, defaultVisible: false },
  { key: "nasa-planner", title: "Planner",      url: "/nasa-planner",   icon: Map,                       alwaysVisible: false, defaultVisible: false },
  { key: "forge",        title: "Forge",        url: "/forge",          icon: Hammer,                    alwaysVisible: false, defaultVisible: false },
  { key: "payment",      title: "Payment",      url: "/payment",        icon: Landmark,                  alwaysVisible: false, defaultVisible: false },
  // ── Sempre visível ──────────────────────────────────────────────────────
  { key: "apps",         title: "Apps",         url: "/apps",           icon: LayoutGrid,                alwaysVisible: true,  defaultVisible: true  },
];

/** Map de app ID → sidebar key (para o toggle nos cards) */
export const APP_TO_SIDEBAR_KEY: Record<string, string> = {
  tracking:       "tracking",
  nasachat:       "nasachat",
  spacetime:      "spacetime",
  cosmic:         "cosmic",
  nbox:           "nbox",
  "nasa-planner": "nasa-planner",
  forge:          "forge",
  payment:        "payment",
  insights:       "insights",
  integrations:   "integrations",
  contatos:       "contatos",
  demand:         "workspaces",
};
