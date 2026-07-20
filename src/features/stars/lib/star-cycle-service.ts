/**
 * Ciclo de Stars — renovação da cota do plano a cada virada de período.
 *
 * A âncora é o período real de cobrança do Stripe (`Subscription.periodStart`),
 * não um relógio interno. Cada ciclo é identificado por um `periodKey`; a unique
 * `(organizationId, periodKey)` em `OrgStarCycle` é o que garante que dois
 * gatilhos concorrentes (webhook e cron) creditem exatamente uma vez.
 */

import { addDays, addMonths, addYears, differenceInMonths } from "date-fns";

import prisma from "@/lib/prisma";
import { Prisma, StarTransactionType } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  ACTIVE_SUB_STATUSES,
  BILLING_ROLES,
  DUNNING_SUB_STATUSES,
} from "@/features/billing/lib/billing-constants";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type CycleSource =
  | "stripe"
  | "cron"
  | "first_activation"
  | "plan_change"
  | "backfill";

export type CycleSkipReason =
  | "duplicate"
  | "no_plan"
  | "dunning"
  | "not_due"
  | "no_subscription";

export interface CycleWindow {
  periodKey: string;
  cycleStart: Date;
  cycleEnd: Date;
  /** Status da assinatura que ancorou a janela; `null` quando não há sub Stripe. */
  subscriptionStatus: string | null;
  isStripeAnchored: boolean;
}

export interface CycleResult {
  applied: boolean;
  reason?: CycleSkipReason;
  periodKey?: string;
  credited?: number;
  rollover?: number;
  balanceAfter?: number;
}

const PRISMA_UNIQUE_VIOLATION = "P2002";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_VIOLATION
  );
}

// ─── Resolução da janela ──────────────────────────────────────────────────────

type CycleInterval = "week" | "month" | "year";

/**
 * O intervalo real vem da assinatura, não do plano: um mesmo `Plan` pode ser
 * cobrado mensal ou anual (`priceId` vs `annualDiscountPriceId`), então
 * `Plan.billingType` isolado pode divergir do que o cliente contratou.
 */
function resolveInterval(
  billingInterval: string | null | undefined,
  planBillingType: string | null | undefined,
): CycleInterval {
  const raw = (billingInterval || planBillingType || "monthly").toLowerCase();
  if (raw.startsWith("week")) return "week";
  if (raw.startsWith("year") || raw.startsWith("annual")) return "year";
  return "month";
}

function advance(from: Date, interval: CycleInterval, steps = 1): Date {
  if (interval === "week") return addDays(from, 7 * steps);
  if (interval === "year") return addYears(from, steps);
  return addMonths(from, steps);
}

/**
 * Resolve a janela corrente de uma org.
 *
 * Com assinatura Stripe: ancora em `periodStart`. Planos anuais são fatiados em
 * 12 recargas mensais — creditar a cota do ano inteiro de uma vez anularia o
 * rollover e deixaria o cliente queimar tudo no primeiro mês.
 *
 * Sem assinatura (plano manual via admin, `partnerLifetimeGranted`): ancora em
 * `starsCycleStart` e avança até conter `now`.
 */
export async function resolveCycleForOrg(
  organizationId: string,
  now: Date = new Date(),
): Promise<CycleWindow | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      createdAt: true,
      starsCycleStart: true,
      plan: { select: { billingType: true } },
    },
  });
  if (!org) return null;

  const billingMembers = await prisma.member.findMany({
    where: {
      organizationId,
      role: { in: BILLING_ROLES as unknown as string[] },
    },
    select: { userId: true },
  });

  // `referenceId` não é único por design (o usuário reassina após cancelar), então
  // um mesmo user acumula linhas antigas — desempatamos pela mais recente.
  //
  // A assinatura ATIVA sempre ganha da inadimplente, mesmo que a inadimplente
  // seja mais recente: quem concede o plano é `recomputeOrgPlan`, que só olha
  // status ativo. Ancorar numa sub `past_due` de outro membro faria a org
  // inteira ser marcada como inadimplente e nunca receber a cota que pagou.
  const candidateSubs =
    billingMembers.length > 0
      ? await prisma.subscription.findMany({
          where: {
            referenceId: { in: billingMembers.map((member) => member.userId) },
            status: {
              in: [...ACTIVE_SUB_STATUSES, ...DUNNING_SUB_STATUSES] as string[],
            },
          },
          orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
          select: {
            stripeSubscriptionId: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            billingInterval: true,
          },
        })
      : [];

  const subscription =
    candidateSubs.find((candidate) =>
      (ACTIVE_SUB_STATUSES as readonly string[]).includes(candidate.status),
    ) ??
    candidateSubs[0] ??
    null;

  const interval = resolveInterval(
    subscription?.billingInterval,
    org.plan?.billingType,
  );

  if (subscription?.stripeSubscriptionId && subscription.periodStart) {
    const anchor = subscription.periodStart;

    if (interval === "year") {
      const monthsElapsed = Math.max(0, differenceInMonths(now, anchor));
      return {
        periodKey: `${subscription.stripeSubscriptionId}:${anchor.toISOString()}:m${monthsElapsed}`,
        cycleStart: addMonths(anchor, monthsElapsed),
        cycleEnd: addMonths(anchor, monthsElapsed + 1),
        subscriptionStatus: subscription.status,
        isStripeAnchored: true,
      };
    }

    return {
      periodKey: `${subscription.stripeSubscriptionId}:${anchor.toISOString()}`,
      cycleStart: anchor,
      cycleEnd: subscription.periodEnd ?? advance(anchor, interval),
      subscriptionStatus: subscription.status,
      isStripeAnchored: true,
    };
  }

  // Sem sub Stripe: avança a partir do último ciclo conhecido até conter `now`.
  //
  // A âncora NUNCA pode ser `now`: o `periodKey` derivado dela mudaria a cada
  // invocação, a unique jamais colidiria e o cron creditaria a cota a cada
  // execução. `createdAt` é estável, então a chave é determinística.
  let cycleStart = org.starsCycleStart ?? org.createdAt;
  let cycleEnd = advance(cycleStart, interval);
  let guard = 0;
  while (cycleEnd <= now && guard < 600) {
    cycleStart = cycleEnd;
    cycleEnd = advance(cycleStart, interval);
    guard++;
  }

  return {
    periodKey: `local:${organizationId}:${cycleStart.toISOString()}`,
    cycleStart,
    cycleEnd,
    subscriptionStatus: subscription?.status ?? null,
    isStripeAnchored: false,
  };
}

// ─── Aplicação do ciclo ───────────────────────────────────────────────────────

interface ApplyCycleArgs {
  organizationId: string;
  window: CycleWindow;
  source: CycleSource;
}

/**
 * Corpo do ciclo, já com o claim garantido pelo chamador. Roda inteiro dentro da
 * transação: se qualquer passo falhar, o claim some junto e o retry reprocessa.
 */
async function applyCycleInTx(
  tx: TransactionClient,
  { organizationId, window, source }: ApplyCycleArgs,
): Promise<CycleResult> {
  const org = await tx.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      starsBalance: true,
      starsProtectedBalance: true,
      partnerLifetimeGranted: true,
      plan: {
        select: { id: true, name: true, monthlyStars: true, rolloverPct: true },
      },
    },
  });

  if (!org.plan) {
    await tx.orgStarCycle.updateMany({
      where: { organizationId, periodKey: window.periodKey },
      data: { status: "skipped_no_plan" },
    });
    return { applied: false, reason: "no_plan", periodKey: window.periodKey };
  }

  const isCreditable =
    window.subscriptionStatus === null ||
    (ACTIVE_SUB_STATUSES as readonly string[]).includes(
      window.subscriptionStatus,
    );

  if (!isCreditable) {
    await tx.orgStarCycle.updateMany({
      where: { organizationId, periodKey: window.periodKey },
      data: { status: "skipped_dunning", planId: org.plan.id },
    });
    return { applied: false, reason: "dunning", periodKey: window.periodKey };
  }

  const { monthlyStars, rolloverPct } = org.plan;

  // O clamp reconcilia a invariante mesmo se algum call-site tiver debitado
  // `starsBalance` direto sem ajustar o protegido.
  const protectedBalance = Math.min(
    org.starsProtectedBalance,
    org.starsBalance,
  );
  const planPortion = org.starsBalance - protectedBalance;
  const maxRollover = Math.floor(monthlyStars * (rolloverPct / 100));
  const rollover = Math.min(planPortion, maxRollover);
  const expired = planPortion - rollover;
  const balanceAfter = rollover + monthlyStars + protectedBalance;

  // Um único update: hoje `runMonthlyCycle` zera e depois soma em dois writes,
  // deixando o saldo lido incorreto entre eles.
  await tx.organization.update({
    where: { id: organizationId },
    data: {
      starsBalance: balanceAfter,
      starsProtectedBalance: protectedBalance,
      starsCycleStart: window.cycleStart,
      starsCycleEnd: window.cycleEnd,
      starsCyclePeriodKey: window.periodKey,
      starsGraceStartedAt: null,
      starsSuspendedAt: null,
      starsLastAlertAt: null,
    },
  });

  const balanceAfterRollover = rollover + protectedBalance;

  if (rollover > 0) {
    await tx.starTransaction.create({
      data: {
        organizationId,
        type: StarTransactionType.ROLLOVER,
        amount: rollover,
        balanceAfter: balanceAfterRollover,
        description: `Rollover do ciclo anterior (${rollover} ★)`,
        periodKey: window.periodKey,
      },
    });
  }

  if (expired > 0) {
    await tx.starTransaction.create({
      data: {
        organizationId,
        type: StarTransactionType.CYCLE_EXPIRE,
        amount: -expired,
        balanceAfter: balanceAfterRollover,
        description: `Expiração de cota não utilizada (${expired} ★ — teto de rollover: ${rolloverPct}% do plano)`,
        periodKey: window.periodKey,
      },
    });
  }

  await tx.starTransaction.create({
    data: {
      organizationId,
      type: StarTransactionType.PLAN_CREDIT,
      amount: monthlyStars,
      balanceAfter,
      description: org.partnerLifetimeGranted
        ? `Crédito mensal do plano ${org.plan.name} (${monthlyStars} ★) — Cortesia NASA Partner Infinity`
        : `Crédito mensal do plano ${org.plan.name} (${monthlyStars} ★)`,
      periodKey: window.periodKey,
    },
  });

  await tx.memberStarBudget.updateMany({
    where: { organizationId },
    data: { currentUsage: 0, cycleStart: window.cycleStart },
  });

  await tx.orgStarCycle.updateMany({
    where: { organizationId, periodKey: window.periodKey },
    data: {
      status: "applied",
      source,
      planId: org.plan.id,
      monthlyStars,
      rolloverApplied: rollover,
      balanceBefore: org.starsBalance,
      balanceAfter,
    },
  });

  return {
    applied: true,
    periodKey: window.periodKey,
    credited: monthlyStars,
    rollover,
    balanceAfter,
  };
}

/**
 * Aplica um ciclo de forma idempotente.
 *
 * O claim (`orgStarCycle.create`) é a primeira instrução da transação — P2002
 * significa que outro gatilho já aplicou este período. Nesse caso tentamos a via
 * de recuperação de inadimplência: uma linha `skipped_dunning` do mesmo período
 * pode ser promovida a `applied` quando a assinatura volta a ficar em dia.
 */
export async function runStarCycle(
  organizationId: string,
  window: CycleWindow,
  source: CycleSource,
): Promise<CycleResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.orgStarCycle.create({
        data: {
          organizationId,
          periodKey: window.periodKey,
          source,
          status: "applied",
          cycleStart: window.cycleStart,
          cycleEnd: window.cycleEnd,
        },
      });
      return applyCycleInTx(tx, { organizationId, window, source });
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    return prisma.$transaction(async (tx) => {
      const revived = await tx.orgStarCycle.updateMany({
        where: {
          organizationId,
          periodKey: window.periodKey,
          status: "skipped_dunning",
        },
        data: { status: "applied", source },
      });
      if (revived.count === 0) {
        return {
          applied: false,
          reason: "duplicate" as const,
          periodKey: window.periodKey,
        };
      }
      return applyCycleInTx(tx, { organizationId, window, source });
    });
  }
}

// ─── Cobrança mensal das integrações ─────────────────────────────────────────

/**
 * Débito mensal de cada integração ativa. Roda FORA da transação do ciclo porque
 * `debitStars` abre a própria transação e dispara alertas — aninhar quebraria.
 *
 * O claim por integração (`lastChargedPeriodKey`) garante no MÁXIMO uma cobrança
 * por ciclo. Como o claim é gravado antes do débito, ele precisa ser LIBERADO
 * quando o débito não acontece (saldo insuficiente ou erro): sem isso a cobrança
 * ficaria marcada como feita e nunca seria retentada naquele período.
 *
 * É seguro chamar em toda reconciliação, não só quando o ciclo credita — as
 * integrações já cobradas caem no `claim.count === 0` e viram no-op.
 */
async function chargeIntegrationsForCycle(
  organizationId: string,
  periodKey: string,
): Promise<number> {
  const { debitStars } = await import("./star-service");

  const integrations = await prisma.workspaceIntegration.findMany({
    where: { organizationId, isActive: true },
    select: { appSlug: true, lastChargedPeriodKey: true, lastChargedAt: true },
  });
  if (integrations.length === 0) return 0;

  const appCosts = await prisma.appStarCost.findMany({
    where: { appSlug: { in: integrations.map((item) => item.appSlug) } },
    select: { appSlug: true, monthlyCost: true },
  });
  const costBySlug = new Map(
    appCosts.map((cost) => [cost.appSlug, cost.monthlyCost]),
  );

  let totalCharged = 0;

  for (const integration of integrations) {
    const monthlyCost = costBySlug.get(integration.appSlug) ?? 0;
    if (monthlyCost <= 0) continue;

    const claim = await prisma.workspaceIntegration.updateMany({
      where: {
        organizationId,
        appSlug: integration.appSlug,
        isActive: true,
        // O NULL precisa ser explícito: `NOT: { campo: valor }` vira
        // `NOT (campo = valor)`, que em SQL é NULL — não TRUE — quando a coluna
        // é NULL, então nenhuma integração nunca-cobrada seria reivindicada.
        OR: [
          { lastChargedPeriodKey: null },
          { lastChargedPeriodKey: { not: periodKey } },
        ],
      },
      data: { lastChargedPeriodKey: periodKey, lastChargedAt: new Date() },
    });
    if (claim.count === 0) continue;

    const releaseClaim = async (): Promise<void> => {
      await prisma.workspaceIntegration.updateMany({
        where: { organizationId, appSlug: integration.appSlug },
        data: {
          lastChargedPeriodKey: integration.lastChargedPeriodKey,
          lastChargedAt: integration.lastChargedAt,
        },
      });
    };

    // Uma integração que falha não pode derrubar as seguintes.
    try {
      const debit = await debitStars(
        organizationId,
        monthlyCost,
        StarTransactionType.APP_CHARGE,
        `Cobrança mensal — ${integration.appSlug} (${monthlyCost} ★)`,
        integration.appSlug,
      );

      if (!debit.success) {
        await releaseClaim();
        console.warn(
          `[stars/cycle] saldo insuficiente para APP_CHARGE org=${organizationId} app=${integration.appSlug} custo=${monthlyCost} — claim liberado para retentativa`,
        );
        continue;
      }

      totalCharged += monthlyCost;
    } catch (error) {
      await releaseClaim().catch(() => {});
      console.error(
        `[stars/cycle] APP_CHARGE falhou org=${organizationId} app=${integration.appSlug}:`,
        error,
      );
    }
  }

  return totalCharged;
}

// ─── Orquestrador ────────────────────────────────────────────────────────────

/**
 * Ponto de entrada único: resolve a janela corrente e aplica o ciclo se ainda
 * não foi aplicado. Chamado pelo hook de assinatura, pelo cron de reconciliação
 * e pela propagação de plano.
 */
export async function ensureStarsCycle(
  organizationId: string,
  source: CycleSource = "cron",
): Promise<CycleResult> {
  const cycleWindow = await resolveCycleForOrg(organizationId);
  if (!cycleWindow) {
    return { applied: false, reason: "no_plan" };
  }

  const result = await runStarCycle(organizationId, cycleWindow, source);

  // Também tenta cobrar quando o ciclo já havia sido aplicado: uma cobrança que
  // falhou por saldo insuficiente devolveu o claim e precisa ser retentada na
  // próxima reconciliação. Integrações já cobradas neste período são no-op.
  if (result.applied || result.reason === "duplicate") {
    await chargeIntegrationsForCycle(organizationId, cycleWindow.periodKey);
  }

  if (result.applied) {
    console.info(
      `[stars/cycle] org=${organizationId} periodKey=${cycleWindow.periodKey} source=${source} applied=true credited=${result.credited} rollover=${result.rollover}`,
    );
  } else {
    console.info(
      `[stars/cycle] org=${organizationId} periodKey=${cycleWindow.periodKey} source=${source} applied=false reason=${result.reason}`,
    );
  }

  return result;
}

/**
 * Reconcilia as Stars após uma mudança de estado do plano.
 *
 * Ponto único usado tanto pelo caminho inline (troca de role, admin, backfill)
 * quanto pelo consumidor Inngest do webhook — a decisão entre "renovar ciclo" e
 * "creditar diferença de upgrade" não pode divergir entre os dois.
 */
export async function syncStarsForPlanState(
  organizationId: string,
  opts: {
    source: CycleSource;
    nextPlanId: string;
  },
): Promise<CycleResult> {
  const cycle = await ensureStarsCycle(organizationId, opts.source);

  // Se o período corrente já tinha sido creditado, o ciclo é no-op — o que resta
  // é a diferença entre a cota do plano atual e o que já foi creditado. Quando
  // não há diferença, `applyPlanChangeDelta` devolve `not_due` sem creditar.
  if (!cycle.applied) {
    return applyPlanChangeDelta(organizationId, opts.nextPlanId);
  }

  return cycle;
}

/**
 * Crédito da diferença ao trocar de plano no meio do ciclo.
 *
 * Sem proração: o Stripe já prorateia o dinheiro, e prorratear Stars produz
 * números que ninguém consegue explicar no suporte. Upgrade credita o delta na
 * hora; downgrade não faz clawback — o teto de rollover menor drena o excesso no
 * ciclo seguinte.
 *
 * O delta é medido contra o que a org JÁ recebeu neste período (somando as
 * linhas `OrgStarCycle` aplicadas), nunca contra o plano anterior. Usar o plano
 * anterior quebrava quando ele era `null`: uma remoção seguida de reaplicação do
 * mesmo plano dentro do período — troca de role de um billing-role, ou
 * recuperação de `past_due` — media o delta contra zero e creditava um mês
 * inteiro de novo. Medir contra o crédito real torna esse caso um no-op e cobre
 * upgrades encadeados (A→B→C) sem contagem dupla.
 */
export async function applyPlanChangeDelta(
  organizationId: string,
  nextPlanId: string,
): Promise<CycleResult> {
  const cycleWindow = await resolveCycleForOrg(organizationId);
  if (!cycleWindow) return { applied: false, reason: "no_plan" };

  const nextPlan = await prisma.plan.findUnique({
    where: { id: nextPlanId },
    select: { name: true, monthlyStars: true },
  });
  if (!nextPlan) return { applied: false, reason: "no_plan" };

  const creditedThisPeriod = await prisma.orgStarCycle.aggregate({
    where: {
      organizationId,
      status: "applied",
      OR: [
        { periodKey: cycleWindow.periodKey },
        { periodKey: { startsWith: `${cycleWindow.periodKey}:upgrade:` } },
      ],
    },
    _sum: { monthlyStars: true },
  });

  const alreadyCredited = creditedThisPeriod._sum.monthlyStars ?? 0;
  const delta = nextPlan.monthlyStars - alreadyCredited;
  if (delta <= 0) {
    return {
      applied: false,
      reason: "not_due",
      periodKey: cycleWindow.periodKey,
    };
  }

  const upgradeKey = `${cycleWindow.periodKey}:upgrade:${nextPlanId}`;

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.orgStarCycle.create({
        data: {
          organizationId,
          periodKey: upgradeKey,
          source: "plan_change",
          status: "applied",
          planId: nextPlanId,
          cycleStart: cycleWindow.cycleStart,
          cycleEnd: cycleWindow.cycleEnd,
          monthlyStars: delta,
        },
      });

      const org = await tx.organization.findUniqueOrThrow({
        where: { id: organizationId },
        select: { starsBalance: true },
      });
      const balanceAfter = org.starsBalance + delta;

      await tx.organization.update({
        where: { id: organizationId },
        data: {
          starsBalance: { increment: delta },
          starsGraceStartedAt: null,
          starsSuspendedAt: null,
        },
      });

      await tx.starTransaction.create({
        data: {
          organizationId,
          type: StarTransactionType.PLAN_UPGRADE_DELTA,
          amount: delta,
          balanceAfter,
          description: `Upgrade para ${nextPlan.name} — diferença de cota do ciclo (${delta} ★)`,
          periodKey: upgradeKey,
        },
      });

      await tx.orgStarCycle.updateMany({
        where: { organizationId, periodKey: upgradeKey },
        data: {
          balanceBefore: org.starsBalance,
          balanceAfter,
        },
      });

      return {
        applied: true,
        periodKey: upgradeKey,
        credited: delta,
        balanceAfter,
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { applied: false, reason: "duplicate", periodKey: upgradeKey };
    }
    throw error;
  }
}
