import {
  Calendar,
  ChartColumnDecreasingIcon,
  CircleCheckIcon,
  ClipboardType,
  Kanban,
  LayoutGrid,
  MessageSquareTextIcon,
  Users,
  FolderOpen,
  Map,
  Hammer,
  Landmark,
  Link2,
  GraduationCap,
  LayoutTemplate,
  Rocket,
  Sparkles,
  TrendingUp,
  Send,
  Satellite,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type React from "react";

export interface SidebarNavItem {
  key: string;
  title: string;
  url: string;
  icon: LucideIcon | React.FC<{ className?: string }>;
  alwaysVisible: boolean;
  defaultVisible: boolean; // visível por padrão se não houver preferência salva
  /** Prefixo que acende o item quando o link não é a raiz do app (ex.: o link abre o último projeto). */
  activePrefix?: string;
}

export const SIDEBAR_NAV_ITEMS: SidebarNavItem[] = [
  // ── Visíveis por padrão (primeiro acesso) ───────────────────────────────
  // Núcleo essencial pra novo user: 6 apps + página de Apps. Resto opt-in
  // via página /apps (botão "+" no card adiciona ao menu).
  {
    key: "tracking",
    title: "Trackings",
    url: "/tracking",
    icon: Kanban,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "workspaces",
    title: "Workspaces",
    // Abre direto o último projeto aberto; a lista fica no botão "Projetos" do quadro.
    url: "/workspaces/recente",
    activePrefix: "/workspaces",
    icon: CircleCheckIcon,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "cosmic",
    title: "Formulários",
    url: "/form",
    icon: ClipboardType,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "nasachat",
    title: "Chats",
    url: "/tracking-chat",
    icon: MessageSquareTextIcon,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "campanhas",
    title: "Campanhas",
    url: "/campanhas",
    icon: Send,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "spacetime",
    title: "Agenda",
    url: "/agendas",
    icon: Calendar,
    alwaysVisible: false,
    defaultVisible: true,
  },
  // Insights — núcleo essencial pra analytics; volta pro default visível
  {
    key: "insights",
    title: "Insights",
    url: "/insights",
    icon: ChartColumnDecreasingIcon,
    alwaysVisible: false,
    defaultVisible: true,
  },
  {
    key: "contatos",
    title: "Contatos",
    url: "/contatos",
    icon: Users,
    alwaysVisible: false,
    defaultVisible: true,
  },
  // ── Ocultos por padrão (opt-in via /apps "+") ───────────────────────────
  {
    key: "nbox",
    title: "N-Box",
    url: "/nbox",
    icon: FolderOpen,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "nasa-planner",
    title: "Planner",
    url: "/nasa-planner",
    icon: Map,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "forge",
    title: "Forge",
    url: "/forge",
    icon: Hammer,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "star-friends",
    title: "STAR FRIENDS",
    url: "/star-friends",
    icon: Sparkles,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "payment",
    title: "Financeiro",
    url: "/payment",
    icon: Landmark,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "linnker",
    title: "Linnker",
    url: "/linnker",
    icon: Link2,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "nasa-route",
    title: "Route",
    url: "/nasa-route",
    icon: GraduationCap,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "nasa-pages",
    title: "Pages",
    url: "/pages",
    icon: LayoutTemplate,
    alwaysVisible: false,
    defaultVisible: false,
  },
  {
    key: "space-station",
    title: "Space Station",
    url: "/space-station",
    icon: Rocket,
    alwaysVisible: false,
    defaultVisible: false,
  },
  // ── Sempre visível ──────────────────────────────────────────────────────
  {
    key: "trafego",
    title: "trafeGO",
    url: "/trafego/painel",
    icon: TrendingUp,
    alwaysVisible: false,
    defaultVisible: false,
  },
  // Integrações fica fixa junto de Apps: é por ela que Gmail, WhatsApp e
  // Instagram entram, e os apps apontam para cá quando falta conexão.
  {
    key: "integrations",
    title: "Satélites",
    url: "/integrations",
    icon: Satellite,
    alwaysVisible: true,
    defaultVisible: true,
  },
  {
    key: "apps",
    title: "Apps",
    url: "/apps",
    icon: LayoutGrid,
    alwaysVisible: true,
    defaultVisible: true,
  },
];

/**
 * Organizações com escopo de produto veem apenas os itens listados aqui —
 * inclusive itens marcados `alwaysVisible`. É restrição de NAVEGAÇÃO: a
 * barreira de autorização real, se necessária, é `OrgPermission`.
 */
export const SCOPED_NAV_KEYS: Record<string, string[]> = {
  trafego: ["trafego"],
};

/** Map de app ID → sidebar key (para o toggle nos cards) */
export const APP_TO_SIDEBAR_KEY: Record<string, string> = {
  tracking: "tracking",
  nasachat: "nasachat",
  spacetime: "spacetime",
  cosmic: "cosmic",
  nbox: "nbox",
  "nasa-planner": "nasa-planner",
  forge: "forge",
  "star-friends": "star-friends",
  payment: "payment",
  linnker: "linnker",
  "nasa-route": "nasa-route",
  "nasa-pages": "nasa-pages",
  "space-station": "space-station",
  campanhas: "campanhas",
  insights: "insights",
  integrations: "integrations",
  contatos: "contatos",
  demand: "workspaces",
  trafego: "trafego",
};
