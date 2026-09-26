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
