export type FloorPattern = "checker" | "planks" | "dots" | "plain";

export type RoomKindKey =
  | "terminal"
  | "chat"
  | "agenda"
  | "meeting"
  | "finance"
  | "workspace"
  | "sales"
  | "field"
  | "restroom"
  | "common"
  | "admin";

/** Atalho de uma sala para o módulo real da plataforma (spec 0120, D-2). `appKey` é o app da matriz de permissões. */
export interface ModuleLink {
  appKey: string;
  label: string;
  href: string;
}

export interface RoomKind {
  label: string;
  module: string;
  color: string;
  floor: readonly [FloorPattern, string, string];
  /** App da matriz que decide quem entra. `null`: sala sempre aberta. */
  accessApp: string | null;
  links: readonly ModuleLink[];
}

const TRACKING: ModuleLink = { appKey: "tracking", label: "Tracking", href: "/tracking" };
const CHAT: ModuleLink = { appKey: "chat", label: "Chat", href: "/tracking-chat" };
const AGENDA: ModuleLink = { appKey: "spacetime", label: "Agenda", href: "/agendas" };
const FINANCE: ModuleLink = { appKey: "financeiro", label: "Financeiro", href: "/payment" };
const WORKSPACE: ModuleLink = { appKey: "workspace", label: "Workspace", href: "/workspaces/recente" };
const FORGE: ModuleLink = { appKey: "forge", label: "Forge", href: "/forge" };

export const ROOM_KINDS: Record<RoomKindKey, RoomKind> = {
  terminal: { label: "Terminal de Chegada", module: "Entrada de leads", color: "#3de0f0", floor: ["checker", "#d8eefc", "#b4d6f0"], accessApp: null, links: [TRACKING] },
  chat: { label: "NasaChat", module: "Nasachat", color: "#43d17a", floor: ["planks", "#b97a52", "#8f5a3a"], accessApp: "chat", links: [CHAT] },
  agenda: { label: "Recepção", module: "Agendas", color: "#ff8a3d", floor: ["planks", "#c7906a", "#a8724f"], accessApp: "spacetime", links: [AGENDA] },
  meeting: { label: "Sala de reuniões", module: "Agendas", color: "#b98cff", floor: ["dots", "#2d2466", "#4c3fa8"], accessApp: "spacetime", links: [AGENDA] },
  finance: { label: "Financeiro", module: "Financeiro", color: "#f4e04d", floor: ["checker", "#dff4e8", "#a8dcc0"], accessApp: "financeiro", links: [FINANCE] },
  workspace: { label: "Workspace", module: "Workspace", color: "#7fb4ff", floor: ["checker", "#33508f", "#4f6fbd"], accessApp: "workspace", links: [WORKSPACE] },
  sales: { label: "Comercial", module: "Tracking · Forge", color: "#ff7a59", floor: ["planks", "#9c6b8f", "#7d5272"], accessApp: "tracking", links: [TRACKING, FORGE] },
  field: { label: "Vendedores externos", module: "Tracking · Agendas", color: "#ff9f43", floor: ["checker", "#f3e2cf", "#e0c4a6"], accessApp: "tracking", links: [TRACKING, AGENDA] },
  restroom: { label: "Banheiros", module: "Workspace (inspeções)", color: "#5fd6c4", floor: ["checker", "#f2f6f7", "#cfdde0"], accessApp: null, links: [] },
  common: { label: "Copa", module: "—", color: "#ffc93c", floor: ["dots", "#ffe58a", "#f2b632"], accessApp: null, links: [] },
  admin: { label: "Administrativo", module: "—", color: "#ff5d8f", floor: ["planks", "#8a6f9e", "#6e5683"], accessApp: null, links: [] },
};

/** Apps da matriz que as salas usam: o servidor só consulta estes (spec 0120, RNF-2). */
export const ROOM_APP_KEYS: readonly string[] = [
  ...new Set(Object.values(ROOM_KINDS).flatMap((kind) => [kind.accessApp, ...kind.links.map((link) => link.appKey)]).filter((appKey): appKey is string => appKey !== null)),
];
