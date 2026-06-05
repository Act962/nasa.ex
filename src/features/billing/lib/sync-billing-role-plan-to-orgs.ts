import prisma from "@/lib/prisma";
import { runMonthlyCycle } from "@/features/stars/lib/star-service";

export const BILLING_ROLES = ["owner", "admin"] as const;
export type BillingRole = (typeof BILLING_ROLES)[number];

const ACTIVE_SUB_STATUSES = ["active", "trialing"];

async function resolvePlanRowFromSubscriptionPlan(planKey: string) {
  return prisma.plan.findFirst({
    where: {
      OR: [
        { slug: planKey },
        { name: { equals: planKey, mode: "insensitive" } },
      ],
    },
  });
}

/**
 * Rederiva Organization.planId a partir das subscriptions ativas dos billing-roles
 * (owner/admin) dessa org. Idempotente: se o planId resultante é igual ao atual, no-op.
 *
 *  - Se há ≥1 billing-role com sub ativa → aplica o plano com maior `Plan.sortOrder`
 *    ("highest wins"). Empate em sortOrder cai no primeiro retornado pelo Prisma.
 *  - Se nenhum billing-role tem sub ativa → zera planId e inicia grace period.
 *  - Primeira ativação (org.starsCycleStart === null) dispara `runMonthlyCycle`.
 */
export async function recomputeOrgPlan(organizationId: string): Promise<void> {
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      role: { in: BILLING_ROLES as unknown as string[] },
    },
    select: { userId: true },
  });
  const billingUserIds = members.map((m) => m.userId);

  let newPlanId: string | null = null;
  if (billingUserIds.length > 0) {
    const activeSubs = await prisma.subscription.findMany({
      where: {
        referenceId: { in: billingUserIds },
        status: { in: ACTIVE_SUB_STATUSES },
      },
      select: { plan: true },
    });

    if (activeSubs.length > 0) {
      const planKeys = [...new Set(activeSubs.map((s) => s.plan.toLowerCase()))];
      const plans = await prisma.plan.findMany({
        where: {
          OR: [
            { slug: { in: planKeys } },
            { name: { in: planKeys, mode: "insensitive" } },
          ],
        },
        orderBy: { sortOrder: "desc" },
      });
      if (plans.length > 0) newPlanId = plans[0].id;
    }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { planId: true, starsCycleStart: true },
  });
  if (!org) return;
  if (org.planId === newPlanId) return;

  if (newPlanId) {
    const isFirstCycle = org.starsCycleStart === null;
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        planId: newPlanId,
        starsGraceStartedAt: null,
        starsSuspendedAt: null,
        ...(isFirstCycle && { starsCycleStart: new Date() }),
      },
    });
    if (isFirstCycle) {
      try {
        await runMonthlyCycle(organizationId);
      } catch (e) {
        console.error(
          `[billing sync] runMonthlyCycle failed for org ${organizationId}:`,
          e,
        );
      }
    }
  } else {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        planId: null,
        starsGraceStartedAt: new Date(),
      },
    });
  }
}

/**
 * Dispara `recomputeOrgPlan` em todas as orgs onde `userId` é billing-role.
 * Usado pelos hooks de subscription do plugin Stripe (onSubscription*).
 */
export async function syncOrgPlansForUser(userId: string): Promise<void> {
  const memberships = await prisma.member.findMany({
    where: { userId, role: { in: BILLING_ROLES as unknown as string[] } },
    select: { organizationId: true },
  });

  for (const { organizationId } of memberships) {
    try {
      await recomputeOrgPlan(organizationId);
    } catch (e) {
      console.error(
        `[billing sync] recomputeOrgPlan failed for org ${organizationId} (trigger=user ${userId}):`,
        e,
      );
    }
  }
}

/**
 * Resolve o `Plan` Prisma a partir do `subscription.plan` (string que o plugin
 * better-auth/stripe armazena: `Plan.name.toLowerCase()`). Tolera divergência
 * entre slug e name.toLowerCase().
 *
 * Exportado pra uso em afterCreateOrganization (Frente C) onde precisamos do
 * plan.id especificamente, antes de qualquer recompute.
 */
export async function resolvePlanFromSubscription(subscriptionPlan: string) {
  return resolvePlanRowFromSubscriptionPlan(subscriptionPlan.toLowerCase());
}
