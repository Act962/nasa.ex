import "server-only";
import prisma from "@/lib/prisma";

/** Dono ou administrador da empresa: quem pode mexer no que envolve dinheiro (chave PIX, gateways). */
export async function isOrgOwnerOrAdmin(organizationId: string, userId: string): Promise<boolean> {
  const member = await prisma.member.findFirst({ where: { organizationId, userId }, select: { role: true } });
  const role = member?.role?.toLowerCase();
  return role === "owner" || role === "admin";
}
