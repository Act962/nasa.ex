// Catálogo único de apps/módulos da matriz de Permissões (Configurações →
// Permissões). Importável no cliente: sem dependência de servidor.

export type PermissionAction = "canView" | "canCreate" | "canEdit" | "canDelete" | "canApprove" | "canPay";
export type ExtendedPermissionAction = Extract<PermissionAction, "canApprove" | "canPay">;

export type AppPermissions = Record<PermissionAction, boolean>;

export type AppPermissionDefinition = {
  key: string;
  label: string;
  icon: string;
  // O que cada ação libera neste app — vira dica na matriz.
  actionHints?: Partial<Record<PermissionAction, string>>;
};

export const ALL_APPS: AppPermissionDefinition[] = [
  // Core
  { key: "tracking",              label: "Tracking / CRM",          icon: "🎯" },
  { key: "tracking-automacoes",   label: "Tracking (Automações)",   icon: "⚡" },
  { key: "contatos",              label: "Contatos",                icon: "👥" },
  {
    key: "lead-produtos",
    label: "Lead · Produtos/Serviços",
    icon: "🛍️",
    actionHints: { canView: "Ver a aba Produtos/Serviços nos Detalhes do lead" },
  },
  { key: "formularios",           label: "Formulários",             icon: "📋" },
  // Comunicação
  { key: "chat",                  label: "Chat / Atendimento",      icon: "💬" },
  { key: "linnker",               label: "Linnker",                 icon: "🔗" },
  // Propostas & Contratos
  { key: "forge",                 label: "Forge / Propostas",       icon: "📄" },
  { key: "forge-contracts",       label: "Contratos",               icon: "✍️" },
  // Agenda & Planejamento
  { key: "spacetime",             label: "SpaceTime / Agenda",      icon: "📅" },
  { key: "nasa-planner",          label: "Planner",                 icon: "🗓️" },
  // Workspace
  { key: "workspace",             label: "Workspace",               icon: "🏢" },
  { key: "workspace-automacoes",  label: "Workspace (Automações)",  icon: "⚙️" },
  // Financeiro
  {
    key: "financeiro",
    label: "Financeiro",
    icon: "💰",
    actionHints: { canApprove: "Aprovar/recusar pagamentos", canPay: "Marcar pagamentos como pagos" },
  },
  // Vendas & Fidelidade
  {
    key: "catalogo-online",
    label: "Catálogo online (NERP)",
    icon: "🛒",
    actionHints: {
      canView: "Ver a integração NERP e os pedidos do catálogo",
      canEdit: "Conectar o NERP e configurar trackings, WhatsApp e Asaas",
      canDelete: "Desconectar a integração NERP",
    },
  },
  {
    key: "star-friends",
    label: "STAR FRIENDS",
    icon: "🌟",
    actionHints: {
      canView: "Ver o programa, saldos, participantes e histórico",
      canCreate: "Resgatar prêmios pelo consultor/chat e lançar stars",
      canEdit: "Instalar, configurar regras e editar a lista de troca",
      canDelete: "Retirar stars e cancelar resgates aprovados (estorno)",
      canApprove: "Aprovar, recusar e marcar como entregues os resgates pendentes",
    },
  },
  // Gamificação
  { key: "stars",                 label: "Stars",                   icon: "⭐" },
  { key: "space-points",          label: "Space Points",            icon: "🏅" },
  // Análise & Navegação
  { key: "insights",              label: "Insights",                icon: "📊" },
  { key: "insights-layout",       label: "Insights · Layout",       icon: "🧩" },
  { key: "nasa-route",            label: "NASA Route",              icon: "🗺️" },
  // Infra
  { key: "integrations",          label: "Integrações",             icon: "🔌" },
  { key: "explorer",              label: "NASA Explorer",           icon: "🚀" },
  { key: "nbox",                  label: "NBox",                    icon: "📦" },
];

export const NASA_ROLES = ["owner", "admin", "member", "moderador"] as const;
export type NasaRole = (typeof NASA_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner: "Master",
  admin: "Adm",
  member: "Single",
  moderador: "Moderador",
};

export const ROLE_COLORS: Record<string, string> = {
  owner: "violet",
  admin: "blue",
  member: "slate",
  moderador: "orange",
};

export const DEFAULT_PERMISSIONS: Record<string, AppPermissions> = {
  owner:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canPay: true  },
  admin:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: true,  canPay: true  },
  member:    { canView: true,  canCreate: true,  canEdit: false, canDelete: false, canApprove: false, canPay: false },
  moderador: { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canPay: false },
};

// Ações além do CRUD, por app — só estes aparecem em "Ações especiais".
export const EXTENDED_ACTIONS_BY_APP: Record<string, ExtendedPermissionAction[]> = {
  financeiro: ["canApprove", "canPay"],
  "star-friends": ["canApprove"],
};

export const APPS_WITH_EXTENDED_ACTIONS = new Set<string>(Object.keys(EXTENDED_ACTIONS_BY_APP));

export function resolveAppPermissions(
  role: string,
  override: AppPermissions | null,
): AppPermissions {
  if (role === "owner") return { ...DEFAULT_PERMISSIONS.owner };
  return override ?? { ...(DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.member) };
}
