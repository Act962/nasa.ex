import "server-only";
import prisma from "@/lib/prisma";
import {
  DEFAULT_PERMISSIONS,
  permissionFieldFor,
  type AppKey,
  type AppPermissions,
  type OrgAction,
} from "../lib/catalog";

/**
 * Resolve a matriz de permissões de um usuário numa organização.
 *
 * Até aqui a matriz que o Master configura em Settings › Permissões era lida
 * quase só pelo cliente (`useCheckPermission`). Faltava o caminho de servidor
 * — e sem ele o Astro não tinha como respeitar o que a tela respeita.
 *
 * A regra é a mesma de `get-permissions.ts`: `OrgPermission` é tabela de
 * OVERRIDE por (org, role, app); linha ausente significa "usa o padrão da
 * role", não "proibido".
 */

export interface ResolvedOrgPermissions {
  role: string;
  /** Só os apps com override; o resto cai no padrão da role. */
  overrides: Record<AppKey, AppPermissions>;
  fallback: AppPermissions;
}

export async function resolveOrgPermissions(
  userId: string,
  organizationId: string,
): Promise<ResolvedOrgPermissions | null> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!member) return null;

  const fallback = DEFAULT_PERMISSIONS[member.role];
  // Papel fora do catálogo (valor livre no banco) não vira acesso por acidente.
  if (!fallback) return null;

  const rows = await prisma.orgPermission.findMany({
    where: { organizationId, role: member.role },
    select: {
      appKey: true,
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canApprove: true,
      canPay: true,
    },
  });

  const overrides: Record<AppKey, AppPermissions> = {};
  for (const row of rows) {
    overrides[row.appKey] = {
      canView: row.canView,
      canCreate: row.canCreate,
      canEdit: row.canEdit,
      canDelete: row.canDelete,
      canApprove: row.canApprove,
      canPay: row.canPay,
    };
  }

  return { role: member.role, overrides, fallback };
}

export function permissionsForApp(
  resolved: ResolvedOrgPermissions,
  appKey: AppKey,
): AppPermissions {
  return resolved.overrides[appKey] ?? resolved.fallback;
}

export function isOrgActionAllowed(
  resolved: ResolvedOrgPermissions | null,
  appKey: AppKey,
  action: OrgAction,
): boolean {
  if (!resolved) return false;
  return permissionsForApp(resolved, appKey)[permissionFieldFor(action)];
}

/**
 * Quem pode liberar acesso. Só o Master altera a matriz
 * (`update-permission.ts`), então é ele que a recusa precisa nomear.
 */
export async function listPermissionGrantersNames(
  organizationId: string,
): Promise<string[]> {
  const owners = await prisma.member.findMany({
    where: { organizationId, role: "owner" },
    select: { user: { select: { name: true } } },
    take: 3,
  });
  return owners
    .map((owner) => owner.user?.name?.trim())
    .filter((name): name is string => Boolean(name));
}
