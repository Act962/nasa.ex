import "server-only";
import prisma from "@/lib/prisma";
import {
  resolveAppPermissions,
  type AppPermissions,
  type PermissionAction,
} from "../lib/app-permission-catalog";

// Mesma regra da matriz em Configurações → Permissões: Master sempre pode;
// demais papéis usam o override da org ou o padrão do papel.
export async function getUserAppPermissions(
  organizationId: string,
  userId: string,
  appKey: string,
): Promise<AppPermissions | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!member) return null;
  const override = await prisma.orgPermission.findUnique({
    where: { organizationId_role_appKey: { organizationId, role: member.role, appKey } },
    select: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canPay: true },
  });
  return resolveAppPermissions(member.role, appKey, override);
}

export async function hasAppPermission(
  organizationId: string,
  userId: string,
  appKey: string,
  action: PermissionAction,
): Promise<boolean> {
  const permissions = await getUserAppPermissions(organizationId, userId, appKey);
  return !!permissions?.[action];
}

/** Permissões de vários apps com duas consultas no total (o papel e os overrides), em vez de duas por app. */
export async function getUserPermissionsForApps(
  organizationId: string,
  userId: string,
  appKeys: readonly string[],
): Promise<Record<string, AppPermissions> | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId, userId },
    select: { role: true },
  });
  if (!member) return null;
  const overrides = await prisma.orgPermission.findMany({
    where: { organizationId, role: member.role, appKey: { in: [...appKeys] } },
    select: { appKey: true, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true, canPay: true },
  });
  const overrideByApp = new Map(overrides.map(({ appKey, ...override }) => [appKey, override]));
  return Object.fromEntries(appKeys.map((appKey) => [appKey, resolveAppPermissions(member.role, appKey, overrideByApp.get(appKey) ?? null)]));
}
