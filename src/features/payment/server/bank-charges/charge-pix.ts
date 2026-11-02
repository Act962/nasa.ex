import "server-only";
import prisma from "@/lib/prisma";
import { DAY_MS, parseCalendarDate, toDateInputValue, toSaoPauloDateInput } from "@/features/payment/lib/dates";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import { getBankAdapter } from "./bank-adapters";
import {
  clearConnectionFailure,
  findChargeConnection,
  isCertificateExpired,
  openConnectedBank,
  recordConnectionFailure,
} from "./connection-store";
import { PixChargeRemovedError } from "./inter-charge-provider";
import { buildPixTxid } from "./ports";

// PIX da cobrança gerado no banco (spec 0130, RF-4, RF-5, RF-7). Criado na primeira vez que
// alguém precisa dele e reaproveitado enquanto valor e vencimento não mudam.

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
  | "timeout";

export type BankPixResult =
  | { ok: true; copyPaste: string }
  | { ok: false; reason: BankPixFallbackReason };

const ENTRY_PIX_SELECT = {
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
  contact: { select: { name: true, document: true } },
  lead: { select: { name: true, document: true } },
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
  const digits = person?.document?.replace(/\D/g, "") ?? "";
  if (!person || (digits.length !== 11 && digits.length !== 14)) return null;
  return { name: person.name, document: digits };
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

async function upsertEntryBankPix(params: { organizationId: string; entryId: string; amountCents: number }): Promise<BankPixResult> {
  const connection = await findChargeConnection(params.organizationId);
  if (!connection) return { ok: false, reason: "no_connection" };
  if (isCertificateExpired(connection)) return { ok: false, reason: "certificate_expired" };

  const entry = await prisma.paymentEntry.findFirst({
    where: { id: params.entryId, organizationId: params.organizationId, type: "RECEIVABLE" },
    select: ENTRY_PIX_SELECT,
  });
  if (!entry || !(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
    return { ok: false, reason: "no_connection" };
  }

  const debtor = toDebtor(entry.contact) ?? toDebtor(entry.lead);
  if (!debtor) return { ok: false, reason: "no_debtor_document" };

  const today = toSaoPauloDateInput();
  const entryDueDate = toDateInputValue(entry.dueDate);
  const isStampCurrent =
    entry.pixConnectionId === connection.id &&
    entry.pixAmountCents === params.amountCents &&
    entry.pixDueDate !== null &&
    isStoredDueDateUsable(toDateInputValue(entry.pixDueDate), entryDueDate, today);
  if (isStampCurrent && entry.pixCopyPaste) return { ok: true, copyPaste: entry.pixCopyPaste };

  const txid = entry.pixTxid ?? buildPixTxid(entry.id);
  const bank = openConnectedBank(connection);
  try {
    const charge = await bank.provider.upsertPixCharge({
      txid,
      amountCents: params.amountCents,
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
    return { ok: true, copyPaste: charge.copyPaste };
  } catch (error) {
    if (error instanceof PixChargeRemovedError) return { ok: false, reason: "charge_removed" };
    const described = getBankAdapter(connection.provider).describeError(error);
    if (described?.isCredentialProblem) await recordConnectionFailure(connection.id, described.message);
    console.warn("[bank-pix] falling back to static PIX", { entryId: entry.id, message: described?.message ?? String(error) });
    return { ok: false, reason: "bank_error" };
  }
}

/**
 * PIX do banco para a conta a receber, ou o motivo de cair no estático (RF-8). Estourou o
 * tempo, quem chama segue com o estático; o PIX do banco ainda é gravado para a próxima vez.
 */
export async function resolveEntryBankPix(params: {
  organizationId: string;
  entryId: string;
  amountCents: number;
  timeoutMs: number;
}): Promise<BankPixResult> {
  const bankPix = upsertEntryBankPix(params).catch((error: unknown): BankPixResult => {
    console.error("[bank-pix] unexpected error", error);
    return { ok: false, reason: "bank_error" };
  });
  return raceWithTimeout<BankPixResult>(bankPix, params.timeoutMs, { ok: false, reason: "timeout" });
}

async function removeEntryBankPix(entry: {
  id: string;
  pixTxid: string;
  pixConnection: Parameters<typeof openConnectedBank>[0];
}): Promise<void> {
  try {
    await openConnectedBank(entry.pixConnection).provider.cancelPixCharge(entry.pixTxid);
    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: { pixCopyPaste: null, pixAmountCents: null, pixDueDate: null },
    });
  } catch (error) {
    const described = getBankAdapter(entry.pixConnection.provider).describeError(error);
    console.warn("[bank-pix] cancel failed", { entryId: entry.id, message: described?.message ?? String(error) });
  }
}

/**
 * RF-7: conta cancelada ou excluída → o PIX some do banco, para o cliente não pagar por
 * algo que não deve. Best-effort e com tempo máximo: falha aqui não desfaz a ação da tela.
 */
export async function cancelEntryBankPix(params: { organizationId: string; entryId: string }): Promise<void> {
  const entry = await prisma.paymentEntry.findFirst({
    where: { id: params.entryId, organizationId: params.organizationId, pixTxid: { not: null } },
    select: { id: true, pixTxid: true, pixConnection: true },
  });
  if (!entry?.pixTxid || !entry.pixConnection) return;
  const { pixTxid, pixConnection } = entry;
  await raceWithTimeout(removeEntryBankPix({ id: entry.id, pixTxid, pixConnection }), SIDE_EFFECT_TIMEOUT_MS, undefined);
}

/**
 * Depois de baixa, baixa parcial, edição ou cancelamento: o PIX do banco acompanha a conta.
 * Quitada ou cancelada, sai do banco (RF-7); em aberto, é revisado para o saldo atual (RF-5),
 * para o cliente não pagar o valor antigo pelo copia e cola que já recebeu.
 */
export async function syncEntryBankPix(params: { organizationId: string; entryId: string }): Promise<void> {
  const entry = await prisma.paymentEntry.findFirst({
    where: { id: params.entryId, organizationId: params.organizationId, pixTxid: { not: null } },
    select: { id: true, status: true, amount: true, paidAmount: true, pixCopyPaste: true },
  });
  if (!entry) return;
  if (!(PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status)) {
    await cancelEntryBankPix(params);
    return;
  }
  if (!entry.pixCopyPaste) return;
  await resolveEntryBankPix({
    organizationId: params.organizationId,
    entryId: entry.id,
    amountCents: Math.max(entry.amount - entry.paidAmount, 0),
    timeoutMs: SIDE_EFFECT_TIMEOUT_MS,
  });
}

const MAX_CHARGES_CANCELLED_ON_DISCONNECT = 100;

/**
 * Antes de desconectar: os PIX ainda em aberto saem do banco. Sem a conexão, ninguém mais
 * consegue cancelá-los nem dar baixa neles, e o cliente pagaria um PIX sem baixa automática.
 * O cliente segue pagando pelo link, que passa a mostrar o PIX com a chave da empresa.
 */
export async function cancelOpenBankPixOfConnection(connectionId: string): Promise<{ cancelled: number }> {
  const entries = await prisma.paymentEntry.findMany({
    where: {
      pixConnectionId: connectionId,
      pixCopyPaste: { not: null },
      status: { in: [...PENDING_ENTRY_STATUSES] },
    },
    select: { id: true, pixTxid: true, pixConnection: true },
    take: MAX_CHARGES_CANCELLED_ON_DISCONNECT,
  });
  let cancelled = 0;
  for (const entry of entries) {
    if (!entry.pixTxid || !entry.pixConnection) continue;
    await removeEntryBankPix({ id: entry.id, pixTxid: entry.pixTxid, pixConnection: entry.pixConnection });
    cancelled += 1;
  }
  return { cancelled };
}
