import { ORPCError } from "@orpc/server";
import prisma from "@/lib/prisma";

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

export async function getMemberRole(
  orgId: string,
  userId: string,
): Promise<string | null> {
  const member = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { role: true },
  });
  return member?.role ?? null;
}

export async function isOrgAdmin(
  orgId: string,
  userId: string,
): Promise<boolean> {
  const role = await getMemberRole(orgId, userId);
  return role !== null && FULL_ACCESS_ROLES.has(role);
}

export async function requireOrgAdmin(
  orgId: string,
  userId: string,
): Promise<void> {
  if (!(await isOrgAdmin(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", {
      message:
        "Apenas administradores podem executar esta operação na integração Comments App.",
    });
  }
}
