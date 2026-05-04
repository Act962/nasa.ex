import prisma from "@/lib/prisma";

/**
 * Decide se um usuário pode editar o layout de Insights de uma organização.
 *
 * Regra:
 *  - role === "owner"     → sempre (Master da empresa)
 *  - role === "moderador" → sempre
 *  - role === "admin"     → só se tiver OrgPermission `insights-layout` canEdit=true
 *  - role === "member"    → nunca
 */
export async function canEditInsightsLayout(
  userId: string,
  orgId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId: orgId },
    select: { role: true },
  });

  if (!member) return false;
  if (member.role === "owner" || member.role === "moderador") return true;
  if (member.role !== "admin") return false;

  const perm = await prisma.orgPermission.findFirst({
    where: {
      organizationId: orgId,
      role: "admin",
      appKey: "insights-layout",
    },
    select: { canEdit: true },
  });

  return Boolean(perm?.canEdit);
}
