import "server-only";
import prisma from "@/lib/prisma";
import { Prisma, type PaymentBankConnection } from "@/generated/prisma/client";
import { parseCalendarDate, toSaoPauloDateInput } from "@/features/payment/lib/dates";
import { applyPaymentToEntry } from "@/features/payment/server/statements/apply-payment";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import { queueJournalSync } from "@/features/accounting/server/journal/queue-journal-sync";
import { dispatchPaymentReceived } from "@/features/workflows/lib/agent-trigger-helpers";
import { openConnectedBank } from "./connection-store";
import { parsePixTxid, type ConfirmedPixPayment } from "./ports";

// Baixa automática (spec 0130, RF-6, RF-11). O pagamento sempre vem da consulta ao banco,
// nunca do corpo do aviso (D-4). Vira um movimento bancário, como o OFX, e casa pelo `txid`.

export type BankPixSettlement =
  | { outcome: "settled"; entryId: string }
  | { outcome: "unmatched" }
  | { outcome: "duplicate" }
  | { outcome: "not_ours" };

function toPostedDate(paidAt: Date): Date {
  return parseCalendarDate(toSaoPauloDateInput(paidAt));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function recordConfirmedBankPix(
  connection: Pick<PaymentBankConnection, "organizationId" | "accountId" | "provider">,
  payment: ConfirmedPixPayment,
): Promise<BankPixSettlement> {
  // Só o PIX gerado pelo ÓRBITA: o resto que cai na conta continua chegando pelo extrato.
  const entryId = parsePixTxid(payment.txid);
  if (!entryId) return { outcome: "not_ours" };

  const entry = await prisma.paymentEntry.findFirst({
    where: { id: entryId, organizationId: connection.organizationId, type: "RECEIVABLE" },
    select: { id: true, amount: true, paidAmount: true, status: true, leadId: true, trackingId: true },
  });
  const isMatchable =
    entry &&
    !payment.hasRefund &&
    (PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status) &&
    payment.amountCents <= entry.amount - entry.paidAmount;

  const postedDate = toPostedDate(payment.paidAt);
  const transactionData = {
    organizationId: connection.organizationId,
    accountId: connection.accountId,
    source: "BANK_API" as const,
    externalId: payment.endToEndId,
    direction: "CREDIT" as const,
    amountCents: payment.amountCents,
    postedAt: payment.paidAt,
    postedDate,
    memo: `PIX recebido pela API do banco (${payment.txid})`,
    memoKind: "PIX",
    counterpartyName: payment.payerName,
    counterpartyDocument: payment.payerDocument,
    rawPayload: payment.raw as Prisma.InputJsonValue,
  };

  try {
    if (!entry || !isMatchable) {
      await prisma.paymentBankTransaction.create({ data: transactionData });
      return { outcome: "unmatched" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.paymentBankTransaction.create({
        data: { ...transactionData, status: "MATCHED", matchedEntryId: entry.id, matchedAt: new Date(), matchMethod: "BANK_TXID" },
      });
      await applyPaymentToEntry(tx, {
        entryId: entry.id,
        amountCents: payment.amountCents,
        paidAt: payment.paidAt,
        accountId: connection.accountId,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate" };
    throw error;
  }

  await queueJournalSync(connection.organizationId, [entry.id]);
  await dispatchPaymentReceived({
    provider: connection.provider,
    externalId: payment.endToEndId,
    organizationId: connection.organizationId,
    trackingId: entry.trackingId,
    leadId: entry.leadId,
    amount: payment.amountCents,
    extra: { entryId: entry.id },
  });
  return { outcome: "settled", entryId: entry.id };
}

/** Confere no banco um aviso recebido e dá a baixa. `null` = o banco não conhece o pagamento. */
export async function confirmAndRecordBankPix(params: {
  organizationId: string;
  connectionId: string;
  endToEndId: string;
}): Promise<BankPixSettlement | null> {
  const connection = await prisma.paymentBankConnection.findFirst({
    where: { id: params.connectionId, organizationId: params.organizationId },
  });
  if (!connection) return null;
  const payment = await openConnectedBank(connection).provider.confirmPixPayment(params.endToEndId);
  if (!payment) return null;
  return recordConfirmedBankPix(connection, payment);
}

const SWEEP_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_SWEEP_CONNECTIONS = 200;

/**
 * RF-11: o banco desiste do aviso depois de ~4 h. Uma vez por dia, antes de marcar vencidas,
 * relê os PIX das últimas 48 h de cada conexão; o que já virou movimento é ignorado.
 */
export async function sweepBankPixPayments(): Promise<{ connections: number; settled: number; failed: number }> {
  const connections = await prisma.paymentBankConnection.findMany({
    where: { account: { isActive: true } },
    take: MAX_SWEEP_CONNECTIONS,
  });
  const until = new Date();
  const since = new Date(until.getTime() - SWEEP_WINDOW_MS);
  let settled = 0;
  let failed = 0;
  for (const connection of connections) {
    try {
      const payments = await openConnectedBank(connection).provider.listPixPayments({ since, until });
      for (const payment of payments) {
        const settlement = await recordConfirmedBankPix(connection, payment);
        if (settlement.outcome === "settled") settled += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("[bank-pix-sweep] connection failed", { connectionId: connection.id, error });
    }
  }
  return { connections: connections.length, settled, failed };
}
