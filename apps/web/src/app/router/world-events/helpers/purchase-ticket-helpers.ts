import { ORPCError } from "@orpc/server";
import { StarTransactionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

/**
 * Helper de compra de ingresso de WorldEvent — padrão espelhado de
 * `executeCoursePurchaseInTx` do NASA Route (helpers/purchase-helpers).
 *
 * Responsabilidades:
 *   1. Debita STARs da org compradora (apenas saldo gastável; bônus não paga).
 *   2. Credita organizador (payoutPercent% — default 90).
 *   3. Cria 1 `WorldEventTicket` ACTIVE com accessToken único.
 *   4. Não muda counters do evento (occupancy é via cron).
 *
 * Atomicidade: tudo dentro do `tx` recebido. Caller controla o
 * `prisma.$transaction(async (tx) => …)`.
 */

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export interface ExecuteTicketPurchaseOpts {
  tx: Tx;
  /** User que vai portar o ingresso (entrar no evento). */
  holderUserId: string;
  /** Org que paga em STARs (geralmente a org ativa do holder). */
  buyerOrgId: string;
  worldEventId: string;
  worldEventTitle: string;
  /** Org dona da Station host (recebe payout). */
  hostOrgId: string;
  /** Preço em STARs gastáveis. */
  priceStars: number;
  /** Split do organizador (0-100). Default 90. */
  payoutPercent?: number;
}

export interface ExecuteTicketPurchaseResult {
  ticketId: string;
  accessToken: string;
  buyerNewBalance: number;
  hostNewBalance: number;
  payoutStars: number;
  platformFee: number;
}

export async function executeTicketPurchaseInTx(
  opts: ExecuteTicketPurchaseOpts,
): Promise<ExecuteTicketPurchaseResult> {
  const {
    tx,
    holderUserId,
    buyerOrgId,
    worldEventId,
    worldEventTitle,
    hostOrgId,
    priceStars,
    payoutPercent = 90,
  } = opts;

  // ── 1. Debit comprador (apenas starsBalance gastável) ─────────────────────
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
  await tx.starTransaction.create({
    data: {
      organizationId: buyerOrgId,
      type: StarTransactionType.EVENT_TICKET_PURCHASE,
      amount: -priceStars,
      balanceAfter: buyerNewBalance,
      description: `Ingresso: ${worldEventTitle}`,
      appSlug: "space-station",
    },
  });

  // ── 2. Payout pro organizador ─────────────────────────────────────────────
  const payoutStars = Math.floor(priceStars * (payoutPercent / 100));
  const platformFee = priceStars - payoutStars;

  let hostNewBalance = 0;
  if (payoutStars > 0 && hostOrgId !== buyerOrgId) {
    const host = await tx.organization.findUniqueOrThrow({
      where: { id: hostOrgId },
      select: { starsBalance: true },
    });
    hostNewBalance = host.starsBalance + payoutStars;
    await tx.organization.update({
      where: { id: hostOrgId },
      data: { starsBalance: hostNewBalance },
    });
    await tx.starTransaction.create({
      data: {
        organizationId: hostOrgId,
        type: StarTransactionType.EVENT_TICKET_PAYOUT,
        amount: payoutStars,
        balanceAfter: hostNewBalance,
        description: `Venda de ingresso: ${worldEventTitle} (taxa ${platformFee} ★ retida)`,
        appSlug: "space-station",
      },
    });
  }

  // ── 3. Cria ticket ────────────────────────────────────────────────────────
  const accessToken = randomBytes(16).toString("hex"); // 32 chars
  const ticket = await tx.worldEventTicket.create({
    data: {
      worldEventId,
      buyerOrgId,
      buyerUserId: holderUserId,
      holderUserId,
      pricePaidStars: priceStars,
      paymentMethod: "stars",
      accessToken,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  return {
    ticketId: ticket.id,
    accessToken,
    buyerNewBalance,
    hostNewBalance,
    payoutStars,
    platformFee,
  };
}
