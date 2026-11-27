import "server-only";
import prisma from "@/lib/prisma";
import type { AppPermissions } from "../lib/app-permission-catalog";

// Exceções de uma pessoa (spec 0152): vencem as do papel. O Master nunca tem exceção.

const PERMISSION_SELECT = {
  appKey: true,
  canView: true,
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canApprove: true,
  canPay: true,
} as const;

type PermissionRow = { appKey: string } & AppPermissions;

function toAppPermissions(row: PermissionRow): AppPermissions {
  return {
    canView: row.canView,
    canCreate: row.canCreate,
    canEdit: row.canEdit,
    canDelete: row.canDelete,
    canApprove: row.canApprove,
    canPay: row.canPay,
  };
}

export async function loadMemberAppOverride(organizationId: string, userId: string, appKey: string): Promise<AppPermissions | null> {
  const row = await prisma.memberAppPermission.findUnique({
    where: { organizationId_userId_appKey: { organizationId, userId, appKey } },
    select: PERMISSION_SELECT,
  });
  return row ? toAppPermissions(row) : null;
}

export async function loadMemberAppOverrides(organizationId: string, userId: string): Promise<Record<string, AppPermissions>> {
  const rows = await prisma.memberAppPermission.findMany({ where: { organizationId, userId }, select: PERMISSION_SELECT });
  return Object.fromEntries(rows.map((row) => [row.appKey, toAppPermissions(row)]));
}

/** Todas as exceções da org, por usuário — só para a tela do Master. */
export async function loadOrgMemberOverrides(organizationId: string): Promise<Record<string, Record<string, AppPermissions>>> {
  const rows = await prisma.memberAppPermission.findMany({ where: { organizationId }, select: { userId: true, ...PERMISSION_SELECT } });
  const byUser: Record<string, Record<string, AppPermissions>> = {};
  for (const row of rows) {
    byUser[row.userId] ??= {};
    byUser[row.userId][row.appKey] = toAppPermissions(row);
  }
  return byUser;
}
