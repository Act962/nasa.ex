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

export interface RoomKind {
  label: string;
  module: string;
  color: string;
  floor: readonly [FloorPattern, string, string];
}

export const ROOM_KINDS: Record<RoomKindKey, RoomKind> = {
  terminal: { label: "Terminal de Chegada", module: "Entrada de leads", color: "#3de0f0", floor: ["checker", "#d8eefc", "#b4d6f0"] },
  chat: { label: "NasaChat", module: "Nasachat", color: "#43d17a", floor: ["planks", "#b97a52", "#8f5a3a"] },
  agenda: { label: "Recepção", module: "Agendas", color: "#ff8a3d", floor: ["planks", "#c7906a", "#a8724f"] },
  meeting: { label: "Sala de reuniões", module: "Agendas", color: "#b98cff", floor: ["dots", "#2d2466", "#4c3fa8"] },
  finance: { label: "Financeiro", module: "Financeiro", color: "#f4e04d", floor: ["checker", "#dff4e8", "#a8dcc0"] },
  workspace: { label: "Workspace", module: "Workspace", color: "#7fb4ff", floor: ["checker", "#33508f", "#4f6fbd"] },
  sales: { label: "Comercial", module: "Tracking · Forge", color: "#ff7a59", floor: ["planks", "#9c6b8f", "#7d5272"] },
  field: { label: "Vendedores externos", module: "Tracking · Agendas", color: "#ff9f43", floor: ["checker", "#f3e2cf", "#e0c4a6"] },
  restroom: { label: "Banheiros", module: "Workspace (inspeções)", color: "#5fd6c4", floor: ["checker", "#f2f6f7", "#cfdde0"] },
  common: { label: "Copa", module: "—", color: "#ffc93c", floor: ["dots", "#ffe58a", "#f2b632"] },
  admin: { label: "Administrativo", module: "—", color: "#ff5d8f", floor: ["planks", "#8a6f9e", "#6e5683"] },
};
