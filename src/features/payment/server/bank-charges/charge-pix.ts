import "server-only";
import prisma from "@/lib/prisma";
import { DAY_MS, parseCalendarDate, toDateInputValue, toSaoPauloDateInput } from "@/features/payment/lib/dates";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import type { PaymentBankConnection } from "@/generated/prisma/client";
import { getBankAdapter } from "./bank-adapters";
import {
  BOLETO_MIN_AMOUNT_CENTS,
  buildBoletoPayer,
  cancelEntryBoleto,
  toDocumentDigits,
  upsertEntryBoleto,
  type BoletoSkipReason,
} from "./charge-boleto";
import {
  clearConnectionFailure,
  findChargeConnection,
  isBoletoEnabled,
  isCertificateExpired,
  openConnectedBank,
  recordConnectionFailure,
} from "./connection-store";
import { PixChargeRemovedError } from "./inter-charge-provider";
import { buildPixTxid } from "./ports";

// Cobrança da conta a receber gerada no banco: boleto com PIX (spec 0133) quando ligado e o
// cliente tem endereço, senão o PIX com vencimento (spec 0130). Criada na primeira vez que
// alguém precisa dela e reaproveitada enquanto valor e vencimento não mudam. Uma por conta.

/** P-2: o PIX aceita pagamento até 30 dias depois do vencimento (passa do último aviso da régua). */
const DAYS_VALID_AFTER_DUE = 30;
/** Efeito colateral de uma ação da tela (baixa, edição, cancelamento): não segura o usuário. */
const SIDE_EFFECT_TIMEOUT_MS = 5_000;

export type BankPixFallbackReason =
  | "no_connection"
  | "certificate_expired"
  | "no_debtor_document"
  | "charge_removed"
  | "bank_error"
  | "timeout"
  | "boleto_processing";

export type BankChargeResult =
  | { ok: true; kind: "PIX"; copyPaste: string; boletoSkippedReason: BoletoSkipReason | null }
  | { ok: true; kind: "BOLETO"; copyPaste: string | null; digitableLine: string; boletoRequestId: string }
  | { ok: false; reason: BankPixFallbackReason };

const ADDRESS_SELECT = {
  name: true,
  document: true,
  email: true,
  addressZipCode: true,
  addressStreet: true,
  addressNumber: true,
  addressComplement: true,
  addressNeighborhood: true,
  addressCity: true,
  addressState: true,
  updatedAt: true,
} as const;

const ENTRY_CHARGE_SELECT = {
  id: true,
  organizationId: true,
  type: true,
  status: true,
  description: true,
  dueDate: true,
  pixTxid: true,
  pixCopyPaste: true,
  pixConnectionId: true,
  pixAmountCents: true,
  pixDueDate: true,
  boletoRequestId: true,
  boletoStatus: true,
  boletoDigitableLine: true,
  boletoAmountCents: true,
  boletoDueDate: true,
  boletoIssuedAt: true,
  contact: { select: ADDRESS_SELECT },
  lead: { select: ADDRESS_SELECT },
} as const;

function addCalendarDays(calendarDate: string, days: number): string {
  return toDateInputValue(new Date(parseCalendarDate(calendarDate).getTime() + days * DAY_MS));
}

/**
 * O banco recusa vencimento no passado ("deve ser igual ou maior a data atual", conferido em
 * produção em 2026-11-02): conta vencida ganha PIX que vence hoje (CB-3).
 */
function resolveBankDueDate(entryDueDate: string, today: string): string {
  return entryDueDate < today ? today : entryDueDate;
}

/** O PIX gravado ainda serve? Para conta vencida, basta não ter expirado no banco. */
function isStoredDueDateUsable(storedDueDate: string, entryDueDate: string, today: string): boolean {
  if (entryDueDate >= today) return storedDueDate === entryDueDate;
  return storedDueDate >= entryDueDate && addCalendarDays(storedDueDate, DAYS_VALID_AFTER_DUE) >= today;
}

function toDebtor(person: { name: string; document: string | null } | null) {
  const document = toDocumentDigits(person?.document ?? null);
  return person && document ? { name: person.name, document } : null;
}

async function raceWithTimeout<T>(work: Promise<T>, timeoutMs: number, onTimeout: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), timeoutMs);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

type EntryForCharge = NonNullable<Awaited<ReturnType<typeof loadEntryForCharge>>>;

async function loadEntryForCharge(organizationId: string, entryId: string) {
  return prisma.paymentEntry.findFirst({
    where: { id: entryId, organizationId, type: "RECEIVABLE" },
    select: ENTRY_CHARGE_SELECT,
  });
}

function describeAndRecordFailure(connection: PaymentBankConnection, entryId: string, error: unknown) {
  const described = getBankAdapter(connection.provider).describeError(error);
  console.warn("[bank-charge] falling back", { entryId, message: described?.message ?? String(error) });
  return described?.isCredentialProblem ? recordConnectionFailure(connection.id, described.message) : Promise.resolve();
}

const BOLETO_IN_USE_STATUSES = ["PROCESSING", "ACTIVE"] as const;

function isBoletoInUse(boletoStatus: string | null): boolean {
  return (BOLETO_IN_USE_STATUSES as readonly string[]).includes(boletoStatus ?? "");
}

async function upsertEntryPix(
  connection: PaymentBankConnection,
  entry: EntryForCharge,
  amountCents: number,
  boletoSkippedReason: BoletoSkipReason | null,
): Promise<BankChargeResult> {
  const debtor = toDebtor(entry.contact) ?? toDebtor(entry.lead);
  if (!debtor) return { ok: false, reason: "no_debtor_document" };

  const today = toSaoPauloDateInput();
  const entryDueDate = toDateInputValue(entry.dueDate);
  const isStampCurrent =
    entry.pixConnectionId === connection.id &&
    entry.pixTxid !== null &&
    entry.pixAmountCents === amountCents &&
    entry.pixDueDate !== null &&
    isStoredDueDateUsable(toDateInputValue(entry.pixDueDate), entryDueDate, today);
  if (isStampCurrent && entry.pixCopyPaste) {
    return { ok: true, kind: "PIX", copyPaste: entry.pixCopyPaste, boletoSkippedReason };
  }

  const txid = entry.pixTxid ?? buildPixTxid(entry.id);
  try {
    const charge = await openConnectedBank(connection).provider.upsertPixCharge({
      txid,
      amountCents,
      dueDate: resolveBankDueDate(entryDueDate, today),
      daysValidAfterDue: DAYS_VALID_AFTER_DUE,
      debtor,
      payerMessage: entry.description,
    });
    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        pixTxid: txid,
        pixCopyPaste: charge.copyPaste,
        pixProvider: connection.provider,
        pixConnectionId: connection.id,
        pixAmountCents: charge.amountCents,
        pixDueDate: parseCalendarDate(charge.dueDate),
      },
    });
    await clearConnectionFailure(connection);
    return { ok: true, kind: "PIX", copyPaste: charge.copyPaste, boletoSkippedReason };
  } catch (error) {
    if (error instanceof PixChargeRemovedError) return { ok: false, reason: "charge_removed" };
    await describeAndRecordFailure(connection, entry.id, error);
    return { ok: false, reason: "bank_error" };
  }
}

type BoletoDecision =
  | { action: "pix"; skippedReason: BoletoSkipReason | null }
  /** Boleto em uso que não pode seguir (saldo abaixo do mínimo do banco): sai do banco e entra o PIX. */
  | { action: "cancel_boleto_then_pix"; skippedReason: BoletoSkipReason }
  | { action: "boleto"; payer: ReturnType<typeof buildBoletoPayer>; isRetryAfterFailure: boolean };

/** Os dados do cliente mudaram depois da emissão que falhou: vale tentar de novo. */
function hasPayerChangedSince(entry: EntryForCharge, since: Date | null): boolean {
  if (!since) return true;
  return [entry.contact?.updatedAt, entry.lead?.updatedAt].some((updatedAt) => updatedAt && updatedAt > since);
}

/**
 * Boleto para esta conta? Boleto já emitido por esta conexão segue valendo mesmo com o boleto
 * desligado depois (RNF-2). Senão, por que não (vai para a tela).
 */
function decideBoleto(connection: PaymentBankConnection, entry: EntryForCharge, amountCents: number): BoletoDecision {
  const payer = buildBoletoPayer(entry.contact, entry.lead);
  const isOwnConnection = entry.boletoRequestId !== null && entry.pixConnectionId === connection.id;
  if (isOwnConnection && isBoletoInUse(entry.boletoStatus)) {
    return amountCents < BOLETO_MIN_AMOUNT_CENTS
      ? { action: "cancel_boleto_then_pix", skippedReason: "below_minimum" }
      : { action: "boleto", payer, isRetryAfterFailure: false };
  }
  if (!isBoletoEnabled(connection)) return { action: "pix", skippedReason: null };
  if (amountCents < BOLETO_MIN_AMOUNT_CENTS) return { action: "pix", skippedReason: "below_minimum" };
  if (!payer) return { action: "pix", skippedReason: "missing_address" };
  if (isOwnConnection && entry.boletoStatus === "FAILED") {
    return hasPayerChangedSince(entry, entry.boletoIssuedAt)
      ? { action: "boleto", payer, isRetryAfterFailure: true }
      : { action: "pix", skippedReason: "boleto_failed" };
  }
  return { action: "boleto", payer, isRetryAfterFailure: false };
}

async function upsertEntryBankCharge(params: { organizationId: string; entryId: string; amountCents: number }): Promise<BankChargeResult> {
  const connection = await findChargeConnection(params.organizationId);
  if (!connection) return { ok: false, reason: "no_connection" };
  if (isCertificateExpired(connection)) return { ok: false, reason: "certificate_expired" };

  const entry = await loadEntryForCharge(params.organizationId, params.entryId);
  if (!entry || !(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
    return { ok: false, reason: "no_connection" };
  }

  const decision = decideBoleto(connection, entry, params.amountCents);
  const bank = openConnectedBank(connection);
  if (decision.action === "cancel_boleto_then_pix" && bank.boletoProvider && entry.boletoRequestId) {
    await cancelEntryBoleto({
      entryId: entry.id,
      requestId: entry.boletoRequestId,
      provider: bank.boletoProvider,
      reason: "Saldo abaixo do mínimo do boleto",
    });
  }
  if (decision.action !== "boleto" || !bank.boletoProvider) {
    return upsertEntryPix(connection, entry, params.amountCents, decision.action === "boleto" ? null : decision.skippedReason);
  }

  const hadBoletoInUse = isBoletoInUse(entry.boletoStatus);
  // RNF-2: uma cobrança só no banco por conta. O PIX da 0130 sai antes de o boleto entrar.
  if (entry.pixTxid && entry.pixCopyPaste && !hadBoletoInUse && entry.pixConnectionId === connection.id) {
    await removeEntryPix(entry.id, entry.pixTxid, connection);
  }
  if (decision.isRetryAfterFailure) {
    // Solta o boleto que falhou para emitir outro com os dados novos do cliente.
    await prisma.paymentEntry.update({ where: { id: entry.id }, data: { boletoStatus: null } });
    entry.boletoStatus = null;
  }
  try {
    const result = await upsertEntryBoleto({
      connection,
      provider: bank.boletoProvider,
      entry,
      amountCents: params.amountCents,
      entryDueDate: toDateInputValue(entry.dueDate),
      payer: decision.payer,
    });
    if (!result.ok) {
      return result.reason === "boleto_failed"
        ? upsertEntryPix(connection, entry, params.amountCents, "boleto_failed")
        : { ok: false, reason: "boleto_processing" };
    }
    await clearConnectionFailure(connection);
    return { ok: true, kind: "BOLETO", copyPaste: result.copyPaste, digitableLine: result.digitableLine, boletoRequestId: result.requestId };
  } catch (error) {
    await describeAndRecordFailure(connection, entry.id, error);
    // Boleto ativo (a revisão falhou): nada de PIX ao lado dele, que deixaria duas cobranças.
    if (hadBoletoInUse) return { ok: false, reason: "bank_error" };
    return upsertEntryPix(connection, entry, params.amountCents, "boleto_failed");
  }
}

/**
 * Cobrança do banco para a conta a receber, ou o motivo de cair no estático (RF-8). Estourou o
 * tempo, quem chama segue com o estático; o PIX ou boleto do banco ainda é gravado para a próxima vez.
 */
export async function resolveEntryBankCharge(params: {
  organizationId: string;
  entryId: string;
  amountCents: number;
  timeoutMs: number;
}): Promise<BankChargeResult> {
  const bankCharge = upsertEntryBankCharge(params).catch((error: unknown): BankChargeResult => {
    console.error("[bank-charge] unexpected error", error);
    return { ok: false, reason: "bank_error" };
  });
  return raceWithTimeout<BankChargeResult>(bankCharge, params.timeoutMs, { ok: false, reason: "timeout" });
}

async function removeEntryPix(entryId: string, pixTxid: string, connection: PaymentBankConnection): Promise<void> {
  try {
    await openConnectedBank(connection).provider.cancelPixCharge(pixTxid);
    await prisma.paymentEntry.update({
      where: { id: entryId },
      data: { pixCopyPaste: null, pixAmountCents: null, pixDueDate: null },
    });
  } catch (error) {
    const described = getBankAdapter(connection.provider).describeError(error);
    console.warn("[bank-pix] cancel failed", { entryId, message: described?.message ?? String(error) });
  }
}

const CANCEL_REASON_PAID = "Pago por outra forma";
const CANCEL_REASON_CANCELLED = "Cobrança cancelada";

async function removeEntryBankCharge(
  entry: { id: string; status: string; pixTxid: string | null; boletoRequestId: string | null; boletoStatus: string | null },
  connection: PaymentBankConnection,
): Promise<void> {
  if (entry.boletoRequestId && isBoletoInUse(entry.boletoStatus)) {
    const boletoProvider = openConnectedBank(connection).boletoProvider;
    if (boletoProvider) {
      await cancelEntryBoleto({
        entryId: entry.id,
        requestId: entry.boletoRequestId,
        provider: boletoProvider,
        reason: entry.status === "PAID" ? CANCEL_REASON_PAID : CANCEL_REASON_CANCELLED,
      });
    }
  }
  if (entry.pixTxid) await removeEntryPix(entry.id, entry.pixTxid, connection);
}

/**
 * RF-7: conta paga por fora, cancelada ou excluída → o PIX e o boleto saem do banco, para o
 * cliente não pagar por algo que não deve. Best-effort e com tempo máximo.
 */
export async function cancelEntryBankPix(params: { organizationId: string; entryId: string }): Promise<void> {
  const entry = await prisma.paymentEntry.findFirst({
    where: {
      id: params.entryId,
      organizationId: params.organizationId,
      OR: [{ pixTxid: { not: null } }, { boletoStatus: { in: [...BOLETO_IN_USE_STATUSES] } }],
    },
    select: { id: true, status: true, pixTxid: true, boletoRequestId: true, boletoStatus: true, pixConnection: true },
  });
  if (!entry?.pixConnection) return;
  await raceWithTimeout(removeEntryBankCharge(entry, entry.pixConnection), SIDE_EFFECT_TIMEOUT_MS, undefined);
}

/**
 * Depois de baixa, baixa parcial, edição ou cancelamento: a cobrança do banco acompanha a conta.
 * Quitada ou cancelada, sai do banco (RF-7); em aberto, é revisada para o saldo atual (RF-5),
 * para o cliente não pagar o valor antigo pelo que já recebeu.
 */
export async function syncEntryBankPix(params: { organizationId: string; entryId: string }): Promise<void> {
  const entry = await prisma.paymentEntry.findFirst({
    where: {
      id: params.entryId,
      organizationId: params.organizationId,
      OR: [{ pixTxid: { not: null } }, { boletoStatus: { in: [...BOLETO_IN_USE_STATUSES] } }],
    },
    select: { id: true, status: true, amount: true, paidAmount: true, pixCopyPaste: true, boletoStatus: true },
  });
  if (!entry) return;
  if (!(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
    await cancelEntryBankPix(params);
    return;
  }
  if (!entry.pixCopyPaste && !isBoletoInUse(entry.boletoStatus)) return;
  await resolveEntryBankCharge({
    organizationId: params.organizationId,
    entryId: entry.id,
    amountCents: Math.max(entry.amount - entry.paidAmount, 0),
    timeoutMs: SIDE_EFFECT_TIMEOUT_MS,
  });
}

const MAX_CHARGES_CANCELLED_ON_DISCONNECT = 100;

/**
 * Antes de desconectar: os PIX e boletos ainda em aberto saem do banco. Sem a conexão, ninguém
 * mais consegue cancelá-los nem dar baixa neles. O cliente segue pagando pelo link, que passa a
 * mostrar o PIX com a chave da empresa.
 */
export async function cancelOpenBankChargesOfConnection(connectionId: string): Promise<{ cancelled: number }> {
  const entries = await prisma.paymentEntry.findMany({
    where: {
      pixConnectionId: connectionId,
      status: { in: [...PENDING_ENTRY_STATUSES] },
      OR: [{ pixCopyPaste: { not: null } }, { boletoStatus: { in: [...BOLETO_IN_USE_STATUSES] } }],
    },
    select: { id: true, status: true, pixTxid: true, boletoRequestId: true, boletoStatus: true, pixConnection: true },
    take: MAX_CHARGES_CANCELLED_ON_DISCONNECT,
  });
  let cancelled = 0;
  for (const entry of entries) {
    if (!entry.pixConnection) continue;
    await removeEntryBankCharge(entry, entry.pixConnection);
    cancelled += 1;
  }
  return { cancelled };
}
