/**
 * Catálogo de apps, papéis e permissões padrão da organização.
 *
 * Mora aqui, e não no router, porque agora tem dois leitores: a tela de
 * Settings › Permissões e o gate das ações do Astro. Um caminho só para a
 * matriz é o que impede o assistente de liberar o que a tela nega.
 */

export const ALL_APPS = [
  // Core
  { key: "tracking",              label: "Tracking / CRM",          icon: "🎯" },
  { key: "tracking-automacoes",   label: "Tracking (Automações)",   icon: "⚡" },
  { key: "contatos",              label: "Contatos",                icon: "👥" },
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
  { key: "financeiro",            label: "Financeiro",              icon: "💰" },
  // Gamificação
  { key: "stars",                 label: "Stars",                   icon: "⭐" },
  { key: "space-points",          label: "Space Points",            icon: "🏅" },
  // Análise & Navegação
  { key: "insights",              label: "Insights",                icon: "📊" },
  { key: "insights-layout",       label: "Insights · Layout",       icon: "🧩" },
  { key: "nasa-route",            label: "ÓRBITA Route",              icon: "🗺️" },
  // Infra
  { key: "integrations",          label: "Integrações",             icon: "🔌" },
  { key: "explorer",              label: "ÓRBITA Explorer",           icon: "🚀" },
  { key: "nbox",                  label: "NBox",                    icon: "📦" },
];

export const NASA_ROLES = ["owner", "admin", "member", "moderador"] as const;
export type NasaRole = (typeof NASA_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  owner:     "Master",
  admin:     "Adm",
  member:    "Single",
  moderador: "Moderador",
};

export const ROLE_COLORS: Record<string, string> = {
  owner:     "violet",
  admin:     "blue",
  member:    "slate",
  moderador: "orange",
};

// Tipo das permissões — `canApprove` e `canPay` são opcionais e só
// interpretados quando `appKey ∈ APPS_WITH_EXTENDED_ACTIONS` (ex: financeiro).
export type AppPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canPay: boolean;
};

// Default permissions per role. Owner/admin recebem canApprove/canPay True
// automaticamente (master pode revogar via UI); member/moderador precisam de
// override explícito em Settings → Permissões → Financeiro.
export const DEFAULT_PERMISSIONS: Record<string, AppPermissions> = {
  owner:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: true,  canApprove: true,  canPay: true  },
  admin:     { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: true,  canPay: true  },
  member:    { canView: true,  canCreate: true,  canEdit: false, canDelete: false, canApprove: false, canPay: false },
  moderador: { canView: true,  canCreate: true,  canEdit: true,  canDelete: false, canApprove: false, canPay: false },
};

// Apps com actions estendidas (`canApprove`, `canPay`). UI da matriz só
// renderiza essas colunas pra esses appKeys; pros demais, ignora silenciosamente.
export const APPS_WITH_EXTENDED_ACTIONS = new Set<string>(["financeiro"]);

/** Chave de app conhecida. String livre no banco; validada na leitura. */
export type AppKey = string;

/** As quatro ações que todo app tem. Aprovar/pagar é eixo à parte. */
export type OrgAction = "view" | "create" | "edit" | "delete";

const ACTION_FIELD: Record<OrgAction, keyof AppPermissions> = {
  view: "canView",
  create: "canCreate",
  edit: "canEdit",
  delete: "canDelete",
};

export function permissionFieldFor(action: OrgAction): keyof AppPermissions {
  return ACTION_FIELD[action];
}

export function appLabel(appKey: string): string {
  return ALL_APPS.find((app) => app.key === appKey)?.label ?? appKey;
}
