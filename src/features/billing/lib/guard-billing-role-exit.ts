import prisma from "@/lib/prisma";
import { BILLING_ROLES } from "./sync-billing-role-plan-to-orgs";

const ACTIVE_SUB_STATUSES = ["active", "trialing"];

/**
 * Bloqueia operações que tirariam `userId` dos billing-roles de `organizationId`
 * (sair, ser removido, ser demovido) quando ele é o ÚNICO pagante da org.
 * Implementa os casos 7/8/12 de [docs/subscription-org-model.md].
 *
 * Retorna `null` se pode prosseguir; `{ reason }` se deve bloquear.
 *
 * Não bloqueia se:
 *  - User não tem sub ativa (não é pagante)
 *  - User não é billing-role da org (já não está cobrindo)
 *  - Outro billing-role da mesma org tem sub ativa cobrindo
 */
export async function guardBillingRoleExit({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId: string;
}): Promise<{ reason: string } | null> {
  const activeSub = await prisma.subscription.findFirst({
    where: {
      referenceId: userId,
      status: { in: ACTIVE_SUB_STATUSES },
    },
    select: { id: true },
  });
  if (!activeSub) return null;

  const myMembership = await prisma.member.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: BILLING_ROLES as unknown as string[] },
    },
    select: { id: true },
  });
  if (!myMembership) return null;

  const otherBillingRoleUserIds = (
    await prisma.member.findMany({
      where: {
        organizationId,
        userId: { not: userId },
        role: { in: BILLING_ROLES as unknown as string[] },
      },
      select: { userId: true },
    })
  ).map((m) => m.userId);

  if (otherBillingRoleUserIds.length > 0) {
    const otherActive = await prisma.subscription.findFirst({
      where: {
        referenceId: { in: otherBillingRoleUserIds },
        status: { in: ACTIVE_SUB_STATUSES },
      },
      select: { id: true },
    });
    if (otherActive) return null;
  }

  return {
    reason:
      "Esse usuário tem uma assinatura ativa cobrindo a empresa e é o único pagante. Cancele a assinatura no portal antes de remover/demover.",
  };
}
