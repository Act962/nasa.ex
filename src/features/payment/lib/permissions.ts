/**
 * Modelo de permissões do NASA Payment.
 *
 * Cada usuário autorizado tem uma `role` (PaymentRole) que define o conjunto
 * default de permissões. Opcionalmente, pode ter um override granular por
 * recurso (campo `permissions: Json` em PaymentAccess). O override SOMA com a
 * role — o cálculo final é `effective = override ?? roleDefault`.
 *
 * Recursos cobertos: dashboard, entries (lançamentos), accounts (contas
 * bancárias), categories, contacts, settings (governança/acesso).
 *
 * Ações: view, create, edit, delete.
 *
 * Convenção de roles:
 *   VIEWER  — só lê
 *   EDITOR  — lê + cria + edita
 *   ADMIN   — tudo, exceto conceder acesso a outros usuários
 *   OWNER   — tudo + concede/revoga acesso, muda governance, vê audit logs
 */

export const PAYMENT_RESOURCES = [
  "dashboard",
  "entries",
  "accounts",
  "categories",
  "contacts",
  "settings",
] as const;

export const PAYMENT_ACTIONS = ["view", "create", "edit", "delete"] as const;

export type PaymentResource = (typeof PAYMENT_RESOURCES)[number];
export type PaymentAction = (typeof PAYMENT_ACTIONS)[number];

export type PaymentPermissionMatrix = Record<
  PaymentResource,
  Record<PaymentAction, boolean>
>;

type RoleName = "VIEWER" | "EDITOR" | "ADMIN" | "OWNER";

function makeMatrix(
  fn: (resource: PaymentResource, action: PaymentAction) => boolean,
): PaymentPermissionMatrix {
  const out = {} as PaymentPermissionMatrix;
  for (const resource of PAYMENT_RESOURCES) {
    out[resource] = {} as Record<PaymentAction, boolean>;
    for (const action of PAYMENT_ACTIONS) {
      out[resource][action] = fn(resource, action);
    }
  }
  return out;
}

export const ROLE_DEFAULTS: Record<RoleName, PaymentPermissionMatrix> = {
  VIEWER: makeMatrix((_resource, action) => action === "view"),
  EDITOR: makeMatrix((resource, action) => {
    if (resource === "settings") return action === "view";
    return action !== "delete";
  }),
  ADMIN: makeMatrix((resource, action) => {
    if (resource === "settings") return action === "view";
    return true;
  }),
  OWNER: makeMatrix(() => true),
};

/**
 * Resolve a matriz efetiva combinando role default com override (JSON do
 * banco). O override é parcial — qualquer chave ausente cai no default.
 */
export function resolveEffectivePermissions(
  role: RoleName,
  override: unknown,
): PaymentPermissionMatrix {
  const base = ROLE_DEFAULTS[role];
  if (!override || typeof override !== "object") return base;
  const out = {} as PaymentPermissionMatrix;
  for (const resource of PAYMENT_RESOURCES) {
    const overrideResource = (override as Record<string, unknown>)[resource];
    out[resource] = { ...base[resource] };
    if (overrideResource && typeof overrideResource === "object") {
      for (const action of PAYMENT_ACTIONS) {
        const overrideValue = (overrideResource as Record<string, unknown>)[action];
        if (typeof overrideValue === "boolean") {
          out[resource][action] = overrideValue;
        }
      }
    }
  }
  return out;
}

/** Labels em português para a UI. */
export const RESOURCE_LABELS: Record<PaymentResource, string> = {
  dashboard: "Dashboard",
  entries: "Lançamentos",
  accounts: "Contas Bancárias",
  categories: "Categorias",
  contacts: "Contatos",
  settings: "Configurações",
};

export const ACTION_LABELS: Record<PaymentAction, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
};

export const ROLE_LABELS: Record<RoleName, string> = {
  VIEWER: "Visualizador",
  EDITOR: "Editor",
  ADMIN: "Administrador",
  OWNER: "Proprietário",
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  VIEWER: "Apenas visualização de relatórios e lançamentos.",
  EDITOR: "Cria e edita lançamentos, contas, categorias e contatos.",
  ADMIN: "Tudo do Editor + exclusão. Não concede acesso a outros.",
  OWNER: "Acesso total. Concede/revoga acesso e ajusta governança.",
};
