/**
 * Catálogo de apps, papéis e permissões padrão da organização.
 *
 * A matriz em si mora em `app-permission-catalog.ts` (fonte única, lida pela
 * tela de Settings › Permissões, pelo gate das procedures e pelo gate das
 * ações do Astro). Aqui ficam só os atalhos usados pelo Astro.
 */

import { ALL_APPS, type AppPermissions } from "./app-permission-catalog";

export {
  ALL_APPS,
  APPS_WITH_EXTENDED_ACTIONS,
  DEFAULT_PERMISSIONS,
  EXTENDED_ACTIONS_BY_APP,
  NASA_ROLES,
  ROLE_COLORS,
  ROLE_LABELS,
  getDefaultAppPermissions,
  resolveAppPermissions,
} from "./app-permission-catalog";
export type { AppPermissions, NasaRole } from "./app-permission-catalog";

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
