import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { StarTransactionType } from "@/generated/prisma/enums";
import { SUBSCRIPTION_PERIOD_DAYS, type SubscriptionPeriod } from "@/features/nasa-route/lib/formats";
import { PLATFORM_FEE_PCT } from "../utils";

type Tx = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

interface CreateSubscriptionArgs {
  tx: Tx;
  enrollmentId: string;
  period: SubscriptionPeriod;
}

/**
 * Cria o registro de `NasaRouteSubscription` após a primeira compra
 * de um curso do formato `subscription`. Roda dentro da TX de compra
 * pra ficar atômico com o enrollment + débito.
 *
 * `nextChargeAt = now + 30 dias` (mensal). V1 só suporta mensal — outros
 * períodos vão pra V2.
 */
export async function createSubscriptionInTx({
  tx,
  enrollmentId,
  period,
}: CreateSubscriptionArgs) {
  const now = new Date();
  const days = SUBSCRIPTION_PERIOD_DAYS[period];
  const nextChargeAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return tx.nasaRouteSubscription.create({
    data: {
      enrollmentId,
      status: "active",
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: nextChargeAt,
      nextChargeAt,
      failedChargeCount: 0,
    },
  });
}

interface ChargeArgs {
  tx: Tx;
  subscriptionId: string;
}

/**
 * Resultado de uma tentativa de cobrança recorrente. Use isso pra
 * decidir o que mostrar pro aluno e qual e-mail mandar.
 */
export type ChargeResult =
  | { ok: true; paidStars: number; payoutStars: number; nextChargeAt: Date }
  | { ok: false; reason: "insufficient_balance" | "subscription_inactive" | "course_missing" | "plan_missing"; failedChargeCount: number; status: string };

/**
 * Executa a cobrança recorrente da assinatura.
 *
 * Fluxo:
 * 1. Carrega subscription + enrollment + course + plan default
 * 2. Verifica saldo da org compradora
 * 3. Se OK → debit/credit + atualiza nextChargeAt += 30d, lastChargedAt, failed=0
 * 4. Se NOK → failedChargeCount++, transição de status:
 *    - failedChargeCount >= 3 → past_due (acesso continua)
 *    - failedChargeCount >= 7 → expired + enrollment.status = "cancelled"
 *
 * Retorna `ChargeResult` que o cron usa pra disparar e-mails/push.
 */
export async function chargeSubscriptionInTx({
  tx,
  subscriptionId,
}: ChargeArgs): Promise<ChargeResult> {
  const sub = await tx.nasaRouteSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      enrollment: {
        select: {
          id: true,
          userId: true,
          buyerOrgId: true,
          courseId: true,
          status: true,
          planId: true,
        },
      },
    },
  });

  if (!sub) {
    return { ok: false, reason: "subscription_inactive", failedChargeCount: 0, status: "missing" };
  }
  if (sub.status !== "active" && sub.status !== "past_due") {
    return {
      ok: false,
      reason: "subscription_inactive",
      failedChargeCount: sub.failedChargeCount,
      status: sub.status,
    };
  }

  const course = await tx.nasaRouteCourse.findUnique({
    where: { id: sub.enrollment.courseId },
    select: {
      id: true,
      title: true,
      creatorOrgId: true,
      isPublished: true,
    },
  });
  if (!course) {
    return { ok: false, reason: "course_missing", failedChargeCount: sub.failedChargeCount, status: sub.status };
  }

  // Plano da assinatura: usa o plano da matrícula original; se faltar,
  // cai no default
  const plan = sub.enrollment.planId
    ? await tx.nasaRoutePlan.findUnique({
        where: { id: sub.enrollment.planId },
        select: { id: true, priceStars: true, name: true },
      })
    : await tx.nasaRoutePlan.findFirst({
        where: { courseId: course.id, isDefault: true },
        select: { id: true, priceStars: true, name: true },
      });

  if (!plan) {
    return { ok: false, reason: "plan_missing", failedChargeCount: sub.failedChargeCount, status: sub.status };
  }

  const priceStars = plan.priceStars;
  const payoutStars = Math.floor(priceStars * (1 - PLATFORM_FEE_PCT));

  // Verifica saldo
  const buyer = await tx.organization.findUniqueOrThrow({
    where: { id: sub.enrollment.buyerOrgId },
    select: { starsBalance: true },
  });

  if (buyer.starsBalance < priceStars) {
    // Saldo insuficiente — incrementa contador
    const newFailed = sub.failedChargeCount + 1;
    let newStatus = sub.status;
    if (newFailed >= 7) {
      newStatus = "expired";
    } else if (newFailed >= 3) {
      newStatus = "past_due";
    }

    await tx.nasaRouteSubscription.update({
      where: { id: sub.id },
      data: {
        failedChargeCount: newFailed,
        status: newStatus,
        // Empurra próxima tentativa pra +1 dia (retry diário até resolver)
        nextChargeAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Se expirou, cancela enrollment
    if (newStatus === "expired") {
      await tx.nasaRouteEnrollment.update({
        where: { id: sub.enrollment.id },
        data: { status: "cancelled" },
      });
    }

    return {
      ok: false,
      reason: "insufficient_balance",
      failedChargeCount: newFailed,
      status: newStatus,
    };
  }

  // Cobrança OK — débito + crédito
  const buyerNew = buyer.starsBalance - priceStars;
  await tx.organization.update({
    where: { id: sub.enrollment.buyerOrgId },
    data: { starsBalance: buyerNew },
  });
  await tx.starTransaction.create({
    data: {
      organizationId: sub.enrollment.buyerOrgId,
      type: StarTransactionType.COURSE_PURCHASE,
      amount: -priceStars,
      balanceAfter: buyerNew,
      description: `Renovação assinatura: ${course.title}`,
      appSlug: "nasa-route",
    },
  });

  const creator = await tx.organization.findUniqueOrThrow({
    where: { id: course.creatorOrgId },
    select: { starsBalance: true },
  });
  const creatorNew = creator.starsBalance + payoutStars;
  await tx.organization.update({
    where: { id: course.creatorOrgId },
    data: { starsBalance: creatorNew },
  });
  await tx.starTransaction.create({
    data: {
      organizationId: course.creatorOrgId,
      type: StarTransactionType.COURSE_PAYOUT,
      amount: payoutStars,
      balanceAfter: creatorNew,
      description: `Renovação assinatura recebida: ${course.title}`,
      appSlug: "nasa-route",
    },
  });

  // Atualiza subscription
  const now = new Date();
  const nextChargeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await tx.nasaRouteSubscription.update({
    where: { id: sub.id },
    data: {
      lastChargedAt: now,
      nextChargeAt,
      currentPeriodStart: now,
      currentPeriodEnd: nextChargeAt,
      failedChargeCount: 0,
      status: "active", // se vinha de past_due, recupera
    },
  });

  // Garante que enrollment tá ativo (caso tenha sido marcado como cancelled antes)
  if (sub.enrollment.status !== "active") {
    await tx.nasaRouteEnrollment.update({
      where: { id: sub.enrollment.id },
      data: { status: "active" },
    });
  }

  return {
    ok: true,
    paidStars: priceStars,
    payoutStars,
    nextChargeAt,
  };
}
