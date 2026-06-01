/**
 * Helpers de finalização e reversão de top-up de Stars via Stripe.
 *
 * Espelha o padrão robusto de `finalizeStripePurchaseInTx` /
 * `revokeStripePurchaseInTx` do NASA Route, adaptado para Stars:
 *  - dedupe por `event.id` (ProcessedStripeEvent) dentro da MESMA transação;
 *  - claim atômica de status (`updateMany where status=...`) → idempotência
 *    mesmo entre `checkout.session.completed` e `payment_intent.succeeded`;
 *  - crédito/débito ATÔMICO (`{ increment }`) — sem read-modify-write.
 *
 * Toda a lógica roda dentro da `tx` recebida do caller (o webhook abre o
 * `$transaction`). Se qualquer passo lançar, o rollback desfaz inclusive o
 * registro do evento → Stripe re-tenta e reprocessa.
 */

import type { PrismaClient } from "@/generated/prisma/client";
import { StarTransactionType } from "@/generated/prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface FinalizeStarsTopUpOpts {
  tx: Tx;
  /** Stripe event.id — usado pra dedupe (ProcessedStripeEvent). */
  eventId: string;
  eventType: string;
  starsPaymentId: string;
  /** Valor recebido pelo Stripe em centavos. Se null, usa o snapshot do payment. */
  receivedBrlCents: number | null;
}

export interface FinalizeStarsTopUpResult {
  alreadyFinalized: boolean;
  newBalance: number;
  effectiveStars: number;
}

/**
 * Credita as Stars de um `StarsPayment` pago. Idempotente:
 *  - registra o `event.id` (P2002 → caller trata duplicata);
 *  - claim `pending → paid`; se outro evento já creditou, devolve
 *    `alreadyFinalized: true` sem refazer side-effects.
 */
export async function finalizeStarsTopUpInTx(
  opts: FinalizeStarsTopUpOpts,
): Promise<FinalizeStarsTopUpResult> {
  const { tx, eventId, eventType, starsPaymentId, receivedBrlCents } = opts;

  // 1. Dedupe de evento — se já processamos este event.id, lança P2002 e o
  //    caller devolve 200 sem reprocessar.
  await tx.processedStripeEvent.create({
    data: { id: eventId, type: eventType, source: "stars" },
  });

  // 2. Claim atômica: só finaliza quem ainda está PENDING.
  const claim = await tx.starsPayment.updateMany({
    where: { id: starsPaymentId, status: "pending" },
    data: { status: "paid", paidAt: new Date() },
  });
  if (claim.count === 0) {
    return { alreadyFinalized: true, newBalance: 0, effectiveStars: 0 };
  }

  const payment = await tx.starsPayment.findUniqueOrThrow({
    where: { id: starsPaymentId },
    select: {
      organizationId: true,
      starsAmount: true,
      amountBrl: true,
      packageId: true,
    },
  });

  // 3. Cupom Stripe reduz o amount_total, mas o cliente comprou `starsAmount`
  //    e recebe a quantidade CHEIA — o desconto é uma promoção legítima do
  //    merchant (allow_promotion_codes só aceita Promotion Codes ativos do
  //    Dashboard). Não reduzimos as Stars proporcionalmente. Como o unit_amount
  //    é fixo, o cliente nunca paga MAIS que o esperado (sem over-credit).
  const expectedCents = Math.round(Number(payment.amountBrl) * 100);
  const effectiveStars = payment.starsAmount;
  if (receivedBrlCents !== null && receivedBrlCents < expectedCents) {
    console.info(
      `[stars/finalize] cupom/desconto aplicado payment=${starsPaymentId} expected=${expectedCents} got=${receivedBrlCents} — credita ${effectiveStars}★ cheios`,
    );
  }

  // 4. Crédito ATÔMICO.
  const credited = await tx.organization.update({
    where: { id: payment.organizationId },
    data: { starsBalance: { increment: effectiveStars } },
    select: { starsBalance: true },
  });

  // 5. Saldo positivo → restaura acesso de org em grace/suspensa.
  if (credited.starsBalance > 0) {
    await tx.organization.update({
      where: { id: payment.organizationId },
      data: { starsGraceStartedAt: null, starsSuspendedAt: null },
    });
  }

  // 6. Auditoria.
  await tx.starTransaction.create({
    data: {
      organizationId: payment.organizationId,
      type: StarTransactionType.TOPUP_PURCHASE,
      amount: effectiveStars,
      balanceAfter: credited.starsBalance,
      description: `Compra de ${effectiveStars.toLocaleString("pt-BR")} ★ (Stripe)`,
      packageId: payment.packageId,
    },
  });

  return {
    alreadyFinalized: false,
    newBalance: credited.starsBalance,
    effectiveStars,
  };
}

export interface RevertStarsTopUpOpts {
  tx: Tx;
  eventId: string;
  eventType: string;
  starsPaymentId: string;
  reason: string;
}

export interface RevertStarsTopUpResult {
  revertedNow: boolean;
  reverted: number;
}

/**
 * Reverte um top-up reembolsado: debita as Stars creditadas.
 * Permite saldo NEGATIVO (decisão de produto) — saldo ≤0 dispara grace/suspensão
 * pelo monitor existente. Idempotente via claim `paid → refunded`.
 */
export async function revertStarsTopUpInTx(
  opts: RevertStarsTopUpOpts,
): Promise<RevertStarsTopUpResult> {
  const { tx, eventId, eventType, starsPaymentId, reason } = opts;

  await tx.processedStripeEvent.create({
    data: { id: eventId, type: eventType, source: "stars" },
  });

  const claim = await tx.starsPayment.updateMany({
    where: { id: starsPaymentId, status: "paid" },
    data: { status: "refunded", refundedAt: new Date() },
  });
  if (claim.count === 0) {
    return { revertedNow: false, reverted: 0 };
  }

  const payment = await tx.starsPayment.findUniqueOrThrow({
    where: { id: starsPaymentId },
    select: { organizationId: true, starsAmount: true },
  });

  const debited = await tx.organization.update({
    where: { id: payment.organizationId },
    data: { starsBalance: { increment: -payment.starsAmount } },
    select: { starsBalance: true },
  });

  await tx.starTransaction.create({
    data: {
      organizationId: payment.organizationId,
      type: StarTransactionType.REFUND,
      amount: -payment.starsAmount,
      balanceAfter: debited.starsBalance,
      description: reason,
    },
  });

  return { revertedNow: true, reverted: payment.starsAmount };
}
