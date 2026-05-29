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

export interface FinalizeStripePurchaseOpts {
  tx: Tx;
  userId: string;
  courseId: string;
  courseTitle: string;
  creatorOrgId: string;
  planId: string;
  planName: string;
  /** Valor pago via Stripe, em centavos BRL. */
  paidBrlCents: number;
  /** Snapshot do equivalente em STARs (usado para payout interno ao criador
   *  enquanto Stripe Connect não está habilitado). */
  priceStarsSnapshot: number;
  /** IDs do Stripe para reconciliação e refund. */
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  /** Org do comprador, quando conhecida (fluxo `authenticated`). null no
   *  resgate público (`flow=public`) — anônimo só vira buyer org após
   *  criar a Organization no signup. */
  buyerOrgId?: string | null;
}

export interface FinalizeStripePurchaseResult {
  enrollment: { id: string };
  payoutStars: number;
  platformFee: number;
  creatorNewBalance: number;
  /** Quando true, indica que a função detectou que essa exata sessão Stripe
   *  já havia sido finalizada antes e o resultado foi um no-op. Útil para o
   *  caller pular side-effects externos (email, CRM, pusher). */
  alreadyFinalized?: boolean;
}

/**
 * Finaliza uma compra paga via Stripe Checkout: cria/atualiza enrollment
 * com refs do Stripe, registra progresso vazio, incrementa contador de
 * alunos e credita o criador (90 %) em STARs.
 *
 * Importante: NÃO debita o comprador — o dinheiro já foi captado pelo
 * Stripe. Use no webhook após `checkout.session.completed`.
 *
 * ## Idempotência
 * Se o enrollment já existe com o MESMO `stripeCheckoutSessionId`, a
 * função é um no-op total: não credita o criador outra vez, não
 * incrementa `studentsCount`, não cria StarTransaction. Isso permite
 * que webhooks duplicados (retries do Stripe) sejam reprocessados sem
 * inflar saldos nem métricas.
 *
 * Quando Stripe Connect for habilitado, o payout em STARs aqui deixa de
 * fazer sentido para criadores com conta conectada (eles receberão BRL
 * direto pelo Stripe). Até lá, mantemos compatibilidade com o saldo Stars.
 */
export async function finalizeStripePurchaseInTx(
  opts: FinalizeStripePurchaseOpts,
): Promise<FinalizeStripePurchaseResult> {
  const {
    tx,
    userId,
    courseId,
    courseTitle,
    creatorOrgId,
    planId,
    planName,
    paidBrlCents,
    priceStarsSnapshot,
    stripeCheckoutSessionId,
    stripePaymentIntentId,
    buyerOrgId,
  } = opts;

  // ── Guard de idempotência ──────────────────────────────────────────────
  // Se já existe enrollment desta sessão Stripe, devolvemos o resultado
  // existente sem refazer os side-effects (payout em Stars,
  // studentsCount++). Stripe pode entregar o mesmo evento N vezes; o
  // resultado precisa ser igual em todas as execuções.
  const existing = await tx.nasaRouteEnrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: {
      id: true,
      stripeCheckoutSessionId: true,
      status: true,
    },
  });
  if (
    existing &&
    existing.stripeCheckoutSessionId === stripeCheckoutSessionId &&
    existing.status === "active"
  ) {
    return {
      enrollment: { id: existing.id },
      payoutStars: 0,
      platformFee: 0,
      creatorNewBalance: 0,
      alreadyFinalized: true,
    };
  }

  // Payout em STARs para o criador (90 %). Quando o snapshot for 0 (caso
  // limite — criador sem cotação Stars), o crédito vira no-op.
  const payoutStars = Math.floor(priceStarsSnapshot * (1 - PLATFORM_FEE_PCT));
  const platformFee = priceStarsSnapshot - payoutStars;

  let creatorNewBalance = 0;
  if (payoutStars > 0) {
    // Increment atômico: evita lost-update se duas transações concorrentes
    // creditarem o mesmo criador (o SET com valor pré-lido era vulnerável).
    const updatedCreator = await tx.organization.update({
      where: { id: creatorOrgId },
      data: { starsBalance: { increment: payoutStars } },
      select: { starsBalance: true },
    });
    creatorNewBalance = updatedCreator.starsBalance;
    await tx.starTransaction.create({
      data: {
        organizationId: creatorOrgId,
        type: StarTransactionType.COURSE_PAYOUT,
        amount: payoutStars,
        balanceAfter: creatorNewBalance,
        description: `Venda Stripe: ${courseTitle} — Plano ${planName} (taxa ${platformFee} ★ retida)`,
        appSlug: "nasa-route",
      },
    });
  }

  const enrollment = await tx.nasaRouteEnrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: {
      userId,
      courseId,
      planId,
      buyerOrgId: buyerOrgId ?? null,
      paidStars: priceStarsSnapshot,
      paidBrlCents,
      stripeCheckoutSessionId,
      stripePaymentIntentId,
      source: "stripe_purchase",
      status: "active",
      paymentRef: stripeCheckoutSessionId,
    },
    update: {
      status: "active",
      paidStars: priceStarsSnapshot,
      paidBrlCents,
      planId,
      buyerOrgId: buyerOrgId ?? undefined,
      stripeCheckoutSessionId,
      stripePaymentIntentId,
      source: "stripe_purchase",
      paymentRef: stripeCheckoutSessionId,
    },
    select: { id: true },
  });

  await tx.nasaRouteProgress.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, completedLessonIds: [] },
    update: {},
  });

  // Só incrementa contagem de alunos quando o enrollment é REALMENTE novo.
  // Se já existia (free-access depois virou stripe_purchase, ou retry de
  // webhook após mudança parcial), não inflar a métrica.
  if (!existing) {
    await tx.nasaRouteCourse.update({
      where: { id: courseId },
      data: { studentsCount: { increment: 1 } },
    });
  }

  return { enrollment, payoutStars, platformFee, creatorNewBalance };
}

export interface RevokeStripePurchaseOpts {
  tx: Tx;
  /** Enrollment a revogar. Identificamos pelo ID porque o lookup é feito
   *  pelo caller via `stripePaymentIntentId` (charge.refunded) ou
   *  `stripeCheckoutSessionId`. */
  enrollmentId: string;
  /** Motivo legível, vira parte da description do StarTransaction. */
  reason: string;
}

export interface RevokeStripePurchaseResult {
  /** True quando a revogação foi feita agora; false quando já havia sido
   *  feita antes (caller deve pular notificações). */
  revokedNow: boolean;
  /** Stars que foram debitados do criador (0 se já estava revogado ou
   *  se o payout original era 0). */
  creatorClawbackStars: number;
}

/**
 * Reverte uma compra finalizada via `finalizeStripePurchaseInTx`.
 *
 * - Marca enrollment como `status="refunded"` (atômico via updateMany).
 * - Debita do criador os Stars do payout original (proporcional ao
 *   `priceStarsSnapshot` salvo no `paidStars`).
 * - Decrementa `studentsCount`.
 * - Cria StarTransaction `REFUND` no histórico do criador.
 *
 * ## Idempotência
 * Usa `updateMany where status='active'` para fazer claim. Se outra
 * execução já revogou, devolve `revokedNow=false` sem fazer nada — o
 * caller pode pular notificações de chargeback.
 *
 * NOTA: não devolve o BRL ao comprador — o reembolso real é feito no
 * Stripe (pelo Dashboard ou via API). Este helper só sincroniza o
 * estado interno (acesso ao curso + saldo Stars do criador).
 */
export async function revokeStripePurchaseInTx(
  opts: RevokeStripePurchaseOpts,
): Promise<RevokeStripePurchaseResult> {
  const { tx, enrollmentId, reason } = opts;

  // ── Claim atômica: só prossegue se ainda está active. ─────────────────
  const claim = await tx.nasaRouteEnrollment.updateMany({
    where: { id: enrollmentId, status: "active" },
    data: { status: "refunded" },
  });
  if (claim.count === 0) {
    return { revokedNow: false, creatorClawbackStars: 0 };
  }

  // ── Carrega snapshot para calcular clawback ──────────────────────────
  const enrollment = await tx.nasaRouteEnrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: {
      paidStars: true,
      courseId: true,
      course: {
        select: {
          title: true,
          creatorOrgId: true,
        },
      },
      plan: { select: { name: true } },
    },
  });

  const payoutStars = Math.floor(enrollment.paidStars * (1 - PLATFORM_FEE_PCT));

  // ── Estorna Stars do criador (atômico via increment negativo) ───────
  if (payoutStars > 0) {
    const updatedCreator = await tx.organization.update({
      where: { id: enrollment.course.creatorOrgId },
      data: { starsBalance: { increment: -payoutStars } },
      select: { starsBalance: true },
    });
    await tx.starTransaction.create({
      data: {
        organizationId: enrollment.course.creatorOrgId,
        type: StarTransactionType.REFUND,
        amount: -payoutStars,
        balanceAfter: updatedCreator.starsBalance,
        description: `Estorno: ${enrollment.course.title}${enrollment.plan ? ` — Plano ${enrollment.plan.name}` : ""} (${reason})`,
        appSlug: "nasa-route",
      },
    });
  }

  // ── Decrementa contagem de alunos ───────────────────────────────────
  await tx.nasaRouteCourse.update({
    where: { id: enrollment.courseId },
    data: { studentsCount: { decrement: 1 } },
  });

  return { revokedNow: true, creatorClawbackStars: payoutStars };
}
