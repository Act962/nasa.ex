import "server-only";
import prisma from "@/lib/prisma";
import { Prisma, type PaymentBankConnection } from "@/generated/prisma/client";
import { parseCalendarDate, toSaoPauloDateInput } from "@/features/payment/lib/dates";
import { applyPaymentToEntry } from "@/features/payment/server/statements/apply-payment";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import { queueJournalSync } from "@/features/accounting/server/journal/queue-journal-sync";
import { dispatchPaymentReceived } from "@/features/workflows/lib/agent-trigger-helpers";
import { applyBoletoState } from "./charge-boleto";
import { openConnectedBank } from "./connection-store";
import { parsePixTxid, type BankBoleto, type ConfirmedPixPayment } from "./ports";

// Baixa automática (spec 0130, RF-6, RF-11; spec 0133, RF-7). O pagamento sempre vem da
// consulta ao banco, nunca do corpo do aviso (D-4). Vira um movimento bancário, como o OFX, e
// casa pelo `txid` (PIX) ou pelo código do boleto.

export type BankPixSettlement =
  | { outcome: "settled"; entryId: string }
  | { outcome: "unmatched" }
  | { outcome: "duplicate" }
  | { outcome: "not_ours" }
  | { outcome: "updated" };

type SettlementConnection = Pick<PaymentBankConnection, "organizationId" | "accountId" | "provider">;

function toPostedDate(paidAt: Date): Date {
  return parseCalendarDate(toSaoPauloDateInput(paidAt));
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function recordConfirmedBankPix(
  connection: SettlementConnection,
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

const BOLETO_PAYMENT_EXTERNAL_PREFIX = "boleto:";

/**
 * Boleto pago (por boleto ou pelo PIX dele). Multa e juros fazem o valor passar do em aberto:
 * a conta é quitada pelo em aberto e o movimento guarda o valor real (spec 0133, D-6).
 */
export async function recordConfirmedBankBoleto(connection: SettlementConnection, boleto: BankBoleto): Promise<BankPixSettlement> {
  if (boleto.status !== "PAID" || !boleto.paidAmountCents) return { outcome: "not_ours" };
  const entry = await prisma.paymentEntry.findFirst({
    where: { boletoRequestId: boleto.requestId, organizationId: connection.organizationId, type: "RECEIVABLE" },
    select: { id: true, amount: true, paidAmount: true, status: true, leadId: true, trackingId: true },
  });
  if (!entry) {
    // Boleto do ÓRBITA que já foi trocado por outro (cancelamento pedido, conta reaberta) e foi
    // pago assim mesmo: entra como "a identificar", o sinal de pagamento em dobro. Boleto
    // emitido fora do ÓRBITA (no app do banco) continua chegando pelo extrato.
    const isOwnReplacedBoleto =
      boleto.reference !== null &&
      (await prisma.paymentEntry.count({
        where: { organizationId: connection.organizationId, type: "RECEIVABLE", id: { endsWith: boleto.reference } },
      })) > 0;
    if (!isOwnReplacedBoleto) return { outcome: "not_ours" };
    return recordUnmatchedBoleto(connection, boleto);
  }

  const outstandingCents = entry.amount - entry.paidAmount;
  const isMatchable = (PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status) && outstandingCents > 0;
  const appliedCents = Math.min(boleto.paidAmountCents, outstandingCents);
  const surplusCents = boleto.paidAmountCents - appliedCents;
  const paidAt = boleto.paidAt ?? new Date();
  const via = boleto.paidVia === "PIX" ? "pelo PIX do boleto" : "por boleto";
  const transactionData = {
    organizationId: connection.organizationId,
    accountId: connection.accountId,
    source: "BANK_API" as const,
    externalId: `${BOLETO_PAYMENT_EXTERNAL_PREFIX}${boleto.requestId}`,
    direction: "CREDIT" as const,
    amountCents: boleto.paidAmountCents,
    postedAt: paidAt,
    postedDate: toPostedDate(paidAt),
    memo: surplusCents > 0 && isMatchable
      ? `Boleto pago ${via} pela API do banco, com acréscimo de multa/juros`
      : `Boleto pago ${via} pela API do banco`,
    memoKind: boleto.paidVia === "PIX" ? "PIX" : "BOLETO",
    counterpartyName: boleto.payerName,
    counterpartyDocument: boleto.payerDocument,
    rawPayload: boleto.raw as Prisma.InputJsonValue,
  };

  try {
    if (!isMatchable) {
      await prisma.paymentBankTransaction.create({ data: transactionData });
      return { outcome: "unmatched" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.paymentBankTransaction.create({
        data: { ...transactionData, status: "MATCHED", matchedEntryId: entry.id, matchedAt: new Date(), matchMethod: "BANK_BOLETO" },
      });
      await applyPaymentToEntry(tx, {
        entryId: entry.id,
        amountCents: appliedCents,
        paidAt,
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
    externalId: transactionData.externalId,
    organizationId: connection.organizationId,
    trackingId: entry.trackingId,
    leadId: entry.leadId,
    amount: boleto.paidAmountCents,
    extra: { entryId: entry.id },
  });
  return { outcome: "settled", entryId: entry.id };
}

async function recordUnmatchedBoleto(connection: SettlementConnection, boleto: BankBoleto): Promise<BankPixSettlement> {
  const paidAt = boleto.paidAt ?? new Date();
  try {
    await prisma.paymentBankTransaction.create({
      data: {
        organizationId: connection.organizationId,
        accountId: connection.accountId,
        source: "BANK_API",
        externalId: `${BOLETO_PAYMENT_EXTERNAL_PREFIX}${boleto.requestId}`,
        direction: "CREDIT",
        amountCents: boleto.paidAmountCents ?? 0,
        postedAt: paidAt,
        postedDate: toPostedDate(paidAt),
        memo: "Boleto substituído pago pela API do banco: confira se houve pagamento em dobro",
        memoKind: boleto.paidVia === "PIX" ? "PIX" : "BOLETO",
        counterpartyName: boleto.payerName,
        counterpartyDocument: boleto.payerDocument,
        rawPayload: boleto.raw as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { outcome: "duplicate" };
    throw error;
  }
  return { outcome: "unmatched" };
}

/**
 * Aviso de cobrança do banco (emitido, pago, cancelado, expirado): confere o boleto na API e
 * aplica. `null` = conexão ou boleto desconhecidos.
 */
export async function confirmAndApplyBankBoleto(params: {
  organizationId: string;
  connectionId: string;
  boletoRequestId: string;
}): Promise<BankPixSettlement | null> {
  const connection = await prisma.paymentBankConnection.findFirst({
    where: { id: params.connectionId, organizationId: params.organizationId },
  });
  const boletoProvider = connection ? openConnectedBank(connection).boletoProvider : null;
  if (!connection || !boletoProvider) return null;
  const boleto = await boletoProvider.getBoleto(params.boletoRequestId);
  if (!boleto) return null;
  if (boleto.status === "PAID") return recordConfirmedBankBoleto(connection, boleto);

  const entry = await prisma.paymentEntry.findFirst({
    where: { boletoRequestId: boleto.requestId, organizationId: connection.organizationId },
    select: { id: true },
  });
  if (!entry) return { outcome: "not_ours" };
  await applyBoletoState(entry.id, boleto);
  return { outcome: "updated" };
}

const SWEEP_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_SWEEP_CONNECTIONS = 200;

/**
 * RF-11: o banco desiste do aviso depois de ~4 h. Uma vez por dia, antes de marcar vencidas,
 * relê os PIX e os boletos pagos das últimas 48 h de cada conexão; o que já virou movimento é ignorado.
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
      const bank = openConnectedBank(connection);
      const payments = await bank.provider.listPixPayments({ since, until });
      for (const payment of payments) {
        const settlement = await recordConfirmedBankPix(connection, payment);
        if (settlement.outcome === "settled") settled += 1;
      }
      // Spec 0133, RF-10: boletos pagos cujo aviso se perdeu.
      const paidBoletos = bank.boletoProvider ? await bank.boletoProvider.listPaidBoletos({ since, until }) : [];
      for (const boleto of paidBoletos) {
        const settlement = await recordConfirmedBankBoleto(connection, boleto);
        if (settlement.outcome === "settled") settled += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("[bank-pix-sweep] connection failed", { connectionId: connection.id, error });
    }
  }
  return { connections: connections.length, settled, failed };
}
