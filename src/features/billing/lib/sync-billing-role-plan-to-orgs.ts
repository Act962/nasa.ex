import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { syncStarsForPlanState } from "@/features/stars/lib/star-cycle-service";
import type { CycleSource } from "@/features/stars/lib/star-cycle-service";
import {
  ACTIVE_SUB_STATUSES,
  BILLING_ROLES,
} from "@/features/billing/lib/billing-constants";

export { BILLING_ROLES };
export type { BillingRole } from "@/features/billing/lib/billing-constants";

/**
 * Contexto do evento Stripe que originou o sync. Presente só no caminho do
 * webhook — é o que decide entre creditar inline ou delegar ao Inngest.
 */
export interface SyncContext {
  stripeEventId?: string;
  stripeEventType?: string;
}

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
 * (owner/admin) dessa org, e reconcilia o ciclo de Stars.
 *
 *  - Se há ≥1 billing-role com sub ativa → aplica o plano com maior `Plan.sortOrder`
 *    ("highest wins"). Empate em sortOrder cai no primeiro retornado pelo Prisma.
 *  - Se nenhum billing-role tem sub ativa → zera planId e inicia grace period.
 *  - Com plano ativo → sempre reconcilia o ciclo. NÃO há early-return quando o
 *    plano não muda: renovação é exatamente o caso em que o plano permanece o
 *    mesmo, e era esse return que impedia a cota de renovar. A idempotência
 *    passou a ser responsabilidade do `periodKey`, não de um short-circuit aqui.
 */
export async function recomputeOrgPlan(
  organizationId: string,
  ctx?: SyncContext,
): Promise<void> {
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
        status: { in: [...ACTIVE_SUB_STATUSES] },
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

  if (!newPlanId) {
    if (org.planId === null) return;
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        planId: null,
        starsGraceStartedAt: new Date(),
        // Zera a âncora pra o cron parar de varrer esta org.
        starsCycleEnd: null,
        starsCyclePeriodKey: null,
      },
    });
    return;
  }

  const previousPlanId = org.planId;
  const isFirstCycle = org.starsCycleStart === null;

  if (previousPlanId !== newPlanId) {
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        planId: newPlanId,
        starsGraceStartedAt: null,
        starsSuspendedAt: null,
      },
    });
  }

  // O plano precisa estar atualizado ANTES do ciclo: numa troca agendada pro fim
  // do período, a virada e a mudança de plano chegam no mesmo evento, e rodar o
  // ciclo antes creditaria a cota do plano antigo.
  const source: CycleSource = isFirstCycle
    ? "first_activation"
    : ctx?.stripeEventId
      ? "stripe"
      : "cron";

  // No caminho do webhook o crédito é delegado ao Inngest: o handler do Stripe
  // precisa responder rápido e o Inngest dá retry se o banco oscilar.
  if (ctx?.stripeEventId) {
    await inngest.send({
      name: "stars/cycle.ensure",
      data: {
        organizationId,
        source,
        nextPlanId: newPlanId,
        stripeEventId: ctx.stripeEventId,
        stripeEventType: ctx.stripeEventType,
      },
    });
    return;
  }

  try {
    await syncStarsForPlanState(organizationId, {
      source,
      nextPlanId: newPlanId,
    });
  } catch (e) {
    console.error(
      `[billing sync] syncStarsForPlanState failed for org ${organizationId}:`,
      e,
    );
  }
}

/**
 * Dispara `recomputeOrgPlan` em todas as orgs onde `userId` é billing-role.
 * Usado pelos hooks de subscription do plugin Stripe (onSubscription*).
 */
export async function syncOrgPlansForUser(
  userId: string,
  ctx?: SyncContext,
): Promise<void> {
  const memberships = await prisma.member.findMany({
    where: { userId, role: { in: BILLING_ROLES as unknown as string[] } },
    select: { organizationId: true },
  });

  for (const { organizationId } of memberships) {
    try {
      await recomputeOrgPlan(organizationId, ctx);
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
