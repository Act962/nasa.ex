import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { MetaAccountKind } from "@/generated/prisma/enums";

const FULL_ACCESS_ROLES = new Set(["owner", "admin"]);

export async function getMemberRole(orgId: string, userId: string): Promise<string | null> {
  const m = await prisma.member.findFirst({
    where: { organizationId: orgId, userId },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function isFullAccessMember(orgId: string, userId: string): Promise<boolean> {
  const role = await getMemberRole(orgId, userId);
  return role !== null && FULL_ACCESS_ROLES.has(role);
}

/**
 * Retorna `null` se o membro tem acesso total (Owner/Admin) — caller deve interpretar
 * como "todas as contas". Se for membro restrito, retorna o array (possivelmente vazio).
 */
export async function getAuthorizedAccountKeys(
  orgId: string,
  userId: string,
  kind: MetaAccountKind,
): Promise<string[] | null> {
  if (await isFullAccessMember(orgId, userId)) return null;

  const rows = await prisma.memberMetaAccountAccess.findMany({
    where: { organizationId: orgId, userId, kind },
    select: { accountKey: true },
  });
  return rows.map((r) => r.accountKey);
}

export async function assertCanAccessAccount(
  orgId: string,
  userId: string,
  kind: MetaAccountKind,
  accountKey: string,
): Promise<void> {
  const allowed = await getAuthorizedAccountKeys(orgId, userId, kind);
  if (allowed === null) return;
  if (!allowed.includes(accountKey)) {
    throw new ORPCError("FORBIDDEN", { message: "Sem permissão para esta conta Meta" });
  }
}

export async function assertIsFullAccessMember(orgId: string, userId: string): Promise<void> {
  if (!(await isFullAccessMember(orgId, userId))) {
    throw new ORPCError("FORBIDDEN", { message: "Apenas Master/Admin pode gerenciar acessos" });
  }
}
