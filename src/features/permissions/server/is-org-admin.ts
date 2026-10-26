import "server-only";
import prisma from "@/lib/prisma";

/** Quem edita os dados cadastrais e a marca da empresa. Compras e slug ficam só com owner/admin. */
export const ORG_PROFILE_EDITOR_ROLES = ["owner", "admin", "moderador"] as const;

export async function hasOrgRole(
  organizationId: string,
  userId: string,
  allowedRoles: readonly string[],
): Promise<boolean> {
  const member = await prisma.member.findFirst({ where: { organizationId, userId }, select: { role: true } });
  const role = member?.role?.toLowerCase();
  return !!role && allowedRoles.includes(role);
}

/** Dono ou administrador da empresa: quem pode mexer no que envolve dinheiro (chave PIX, gateways, compra de Stars). */
export async function isOrgOwnerOrAdmin(organizationId: string, userId: string): Promise<boolean> {
  return hasOrgRole(organizationId, userId, ["owner", "admin"]);
}
