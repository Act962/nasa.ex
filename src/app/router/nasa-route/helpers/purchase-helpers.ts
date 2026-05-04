import { ORPCError } from "@orpc/server";
import { StarTransactionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { PLATFORM_FEE_PCT } from "../utils";

/**
 * Cliente de transação do Prisma — versão "stripped" do PrismaClient sem os
 * helpers de transação ($connect, $transaction etc).
 */
type Tx = Omit<
  PrismaClient,
  | "$connect"
  | "$disconnect"
  | "$on"
  | "$transaction"
  | "$use"
  | "$extends"
>;

export interface ExecuteCoursePurchaseOpts {
  tx: Tx;
  userId: string;
  buyerOrgId: string;
  courseId: string;
  courseTitle: string;
  creatorOrgId: string;
  planId: string;
  planName: string;
  /** Preço total cobrado do comprador (em STARS gastáveis). */
  priceStars: number;
  /** Origem do enrollment. Default `"purchase"`. */
  source?: "purchase";
}

export interface ExecuteCoursePurchaseResult {
  enrollment: { id: string };
  buyerNewBalance: number;
  creatorNewBalance: number;
  payoutStars: number;
  platformFee: number;
  debitTransactionId: string;
}

/**
 * Executa o débito do comprador + crédito do criador (90 %) + matrícula +
 * progresso vazio + incremento do `studentsCount`. Tudo dentro da transação
 * `tx` recebida (caller responsabilidade).
 *
 * Bônus (`starsBonusBalance`) NUNCA é consumido aqui — só `starsBalance`
 * gastável paga curso. Se o saldo gastável não cobrir, lança
 * `INSUFFICIENT_STARS`.
 */
export async function executeCoursePurchaseInTx(
  opts: ExecuteCoursePurchaseOpts,
): Promise<ExecuteCoursePurchaseResult> {
  const {
    tx,
    userId,
    buyerOrgId,
    courseId,
    courseTitle,
    creatorOrgId,
    planId,
    planName,
    priceStars,
    source = "purchase",
  } = opts;

  // ── Debit comprador (apenas starsBalance gastável) ─────────────────────
  const buyer = await tx.organization.findUniqueOrThrow({
    where: { id: buyerOrgId },
    select: { starsBalance: true, starsBonusBalance: true },
  });
  if (buyer.starsBalance < priceStars) {
    throw new ORPCError("BAD_REQUEST", {
      message: `Saldo de STARs insuficiente. Necessário: ${priceStars} ★`,
      data: {
        code: "INSUFFICIENT_STARS",
        balance: buyer.starsBalance,
        bonusBalance: buyer.starsBonusBalance,
        needed: priceStars,
      },
    });
  }
  const buyerNewBalance = buyer.starsBalance - priceStars;
  await tx.organization.update({
    where: { id: buyerOrgId },
    data: { starsBalance: buyerNewBalance },
  });
  const debit = await tx.starTransaction.create({
    data: {
      organizationId: buyerOrgId,
      type: StarTransactionType.COURSE_PURCHASE,
      amount: -priceStars,
      balanceAfter: buyerNewBalance,
      description: `Compra: ${courseTitle} — Plano ${planName}`,
      appSlug: "nasa-route",
    },
  });

  // ── Credit criador (90 %) ──────────────────────────────────────────────
  const payoutStars = Math.floor(priceStars * (1 - PLATFORM_FEE_PCT));
  const platformFee = priceStars - payoutStars;

  const creator = await tx.organization.findUniqueOrThrow({
    where: { id: creatorOrgId },
    select: { starsBalance: true },
  });
  const creatorNewBalance = creator.starsBalance + payoutStars;
  await tx.organization.update({
    where: { id: creatorOrgId },
    data: { starsBalance: creatorNewBalance },
  });
  await tx.starTransaction.create({
    data: {
      organizationId: creatorOrgId,
      type: StarTransactionType.COURSE_PAYOUT,
      amount: payoutStars,
      balanceAfter: creatorNewBalance,
      description: `Venda: ${courseTitle} — Plano ${planName} (taxa ${platformFee} ★ retida)`,
      appSlug: "nasa-route",
    },
  });

  // ── Enrollment + progress + counter ────────────────────────────────────
  const enrollment = await tx.nasaRouteEnrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      planId,
      buyerOrgId,
      paidStars: priceStars,
      source,
      status: "active",
      paymentRef: debit.id,
    },
    update: {
      status: "active",
      paidStars: priceStars,
      planId,
      buyerOrgId,
      paymentRef: debit.id,
    },
    select: { id: true },
  });

  await tx.nasaRouteProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, completedLessonIds: [] },
    update: {},
  });

  await tx.nasaRouteCourse.update({
    where: { id: courseId },
    data: { studentsCount: { increment: 1 } },
  });

  return {
    enrollment,
    buyerNewBalance,
    creatorNewBalance,
    payoutStars,
    platformFee,
    debitTransactionId: debit.id,
  };
}
