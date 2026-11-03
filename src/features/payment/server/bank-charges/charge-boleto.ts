import "server-only";
import prisma from "@/lib/prisma";
import { DAY_MS, parseCalendarDate, toDateInputValue, toSaoPauloDateInput } from "@/features/payment/lib/dates";
import type { PaymentBankConnection } from "@/generated/prisma/client";
import type { BankBoleto, BankBoletoProvider, BoletoPayer } from "./ports";

// Boleto com PIX da conta a receber (spec 0133). Emitido sob demanda, como o PIX da 0130; o
// banco devolve o boleto pronto em segundos, pela consulta ou pelo aviso de cobrança.

export const BOLETO_MIN_AMOUNT_CENTS = 250;
/** P-5: o boleto expira no banco 30 dias depois do vencimento, como a validade do PIX. */
const BOLETO_DAYS_VALID_AFTER_DUE = 30;
const BOLETO_POLL_INTERVAL_MS = 1_500;
const BOLETO_POLL_MAX_MS = 25_000;
/** O banco só emite boleto que vence hoje até 19h59 (horário de Brasília). */
const SAME_DAY_CUTOFF = "19:59";

export type BoletoSkipReason = "missing_address" | "below_minimum" | "boleto_failed";

interface PersonWithAddress {
  name: string;
  document: string | null;
  email: string | null;
  addressZipCode: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
}

/** CPF (11) ou CNPJ (14) só com números; qualquer outra coisa não serve ao banco. */
export function toDocumentDigits(document: string | null): string | null {
  const digits = document?.replace(/\D/g, "") ?? "";
  return digits.length === 11 || digits.length === 14 ? digits : null;
}

function documentDigits(person: PersonWithAddress | null): string | null {
  return toDocumentDigits(person?.document ?? null);
}

function addressOf(person: PersonWithAddress | null) {
  if (!person) return null;
  const zipCode = person.addressZipCode?.replace(/\D/g, "") ?? "";
  const street = person.addressStreet?.trim();
  const city = person.addressCity?.trim();
  const state = person.addressState?.trim().toUpperCase();
  if (zipCode.length !== 8 || !street || !city || !state || state.length !== 2) return null;
  return {
    zipCode,
    street,
    city,
    state,
    number: person.addressNumber?.trim() || null,
    complement: person.addressComplement?.trim() || null,
    neighborhood: person.addressNeighborhood?.trim() || null,
  };
}

/** D-7: documento e nome como no PIX (contato, depois lead); endereço do contato, depois do lead. */
export function buildBoletoPayer(contact: PersonWithAddress | null, lead: PersonWithAddress | null): BoletoPayer | null {
  const documentOwner = documentDigits(contact) ? contact : documentDigits(lead) ? lead : null;
  const document = documentDigits(documentOwner);
  const address = addressOf(contact) ?? addressOf(lead);
  if (!documentOwner || !document || !address) return null;
  return { document, name: documentOwner.name, email: documentOwner.email, ...address };
}

function currentTimeInSaoPaulo(): string {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
}

/** Vencido ou hoje depois do horário-limite: vence no próximo dia possível (CB-4, CB-5). */
export function resolveBoletoDueDate(entryDueDate: string): string {
  const today = toSaoPauloDateInput();
  const earliest =
    currentTimeInSaoPaulo() >= SAME_DAY_CUTOFF
      ? toDateInputValue(new Date(parseCalendarDate(today).getTime() + DAY_MS))
      : today;
  return entryDueDate < earliest ? earliest : entryDueDate;
}

/**
 * O Inter devolve linha digitável e PIX ainda "em processamento" (conferido em 2026-11-03,
 * vencimento no mesmo dia): com eles em mãos, o boleto já pode ser mostrado.
 */
function isBoletoReady(boleto: BankBoleto): boolean {
  return boleto.status !== "PROCESSING" || Boolean(boleto.digitableLine);
}

/** Grava na conta a receber o que o banco diz do boleto. Usado pela página, pela régua e pelo aviso. */
export async function applyBoletoState(entryId: string, boleto: BankBoleto): Promise<void> {
  if (!isBoletoReady(boleto)) return;
  if (boleto.status === "CANCELLED" || boleto.status === "EXPIRED") {
    // RF-9: liberado para emitir outro na próxima vez.
    await prisma.paymentEntry.updateMany({
      where: { id: entryId, boletoRequestId: boleto.requestId },
      data: {
        boletoRequestId: null,
        boletoStatus: null,
        boletoDigitableLine: null,
        boletoBarcode: null,
        boletoAmountCents: null,
        boletoDueDate: null,
        pixCopyPaste: null,
      },
    });
    return;
  }
  if (boleto.status === "FAILED") {
    await prisma.paymentEntry.updateMany({
      where: { id: entryId, boletoRequestId: boleto.requestId },
      data: { boletoStatus: "FAILED", pixCopyPaste: null },
    });
    return;
  }
  // Só boleto ainda em uso: um aviso atrasado de "ativo" não ressuscita o que pedimos para cancelar.
  await prisma.paymentEntry.updateMany({
    where: { id: entryId, boletoRequestId: boleto.requestId, boletoStatus: { in: ["PROCESSING", "ACTIVE"] } },
    data: {
      boletoStatus: "ACTIVE",
      boletoDigitableLine: boleto.digitableLine,
      boletoBarcode: boleto.barcode,
      pixCopyPaste: boleto.pixCopyPaste,
    },
  });
}

async function waitForBoleto(provider: BankBoletoProvider, requestId: string): Promise<BankBoleto | null> {
  const deadline = Date.now() + BOLETO_POLL_MAX_MS;
  while (Date.now() < deadline) {
    const boleto = await provider.getBoleto(requestId);
    if (boleto && isBoletoReady(boleto)) return boleto;
    await new Promise((resolve) => setTimeout(resolve, BOLETO_POLL_INTERVAL_MS));
  }
  return null;
}

export interface EntryBoletoState {
  id: string;
  description: string;
  boletoRequestId: string | null;
  boletoStatus: "PROCESSING" | "ACTIVE" | "FAILED" | null;
  boletoDigitableLine: string | null;
  boletoAmountCents: number | null;
  boletoDueDate: Date | null;
  pixCopyPaste: string | null;
  pixConnectionId: string | null;
}

export type EntryBoletoResult =
  | { ok: true; copyPaste: string | null; digitableLine: string; requestId: string }
  | { ok: false; reason: "boleto_processing" | "boleto_failed" };

/**
 * Emite, atualiza ou reaproveita o boleto da conta a receber. Boleto ainda sendo gerado no
 * banco: espera até 25 s e grava quando ficar pronto, mesmo que quem pediu já tenha seguido.
 */
export async function upsertEntryBoleto(params: {
  connection: PaymentBankConnection;
  provider: BankBoletoProvider;
  entry: EntryBoletoState;
  amountCents: number;
  entryDueDate: string;
  /** Só é preciso para emitir; boleto já emitido segue sem ele. */
  payer: BoletoPayer | null;
}): Promise<EntryBoletoResult> {
  const { connection, provider, entry, amountCents, payer } = params;
  const dueDate = resolveBoletoDueDate(params.entryDueDate);
  // `boletoStatus` nulo com código guardado = cancelamento pedido ao banco: emite outro.
  const isOwnBoleto =
    entry.boletoRequestId !== null &&
    entry.pixConnectionId === connection.id &&
    (entry.boletoStatus === "PROCESSING" || entry.boletoStatus === "ACTIVE" || entry.boletoStatus === "FAILED");

  if (isOwnBoleto && entry.boletoRequestId && entry.boletoStatus === "FAILED") return { ok: false, reason: "boleto_failed" };

  if (isOwnBoleto && entry.boletoRequestId && entry.boletoStatus === "ACTIVE" && entry.boletoDigitableLine) {
    const storedDueDate = entry.boletoDueDate ? toDateInputValue(entry.boletoDueDate) : null;
    // Conta vencida: o boleto gravado serve enquanto o banco não o expira (aí vem o aviso e ele é solto).
    const isOverdue = params.entryDueDate < dueDate;
    const isDueDateUsable = isOverdue
      ? storedDueDate !== null && storedDueDate >= params.entryDueDate
      : storedDueDate === params.entryDueDate;
    if (entry.boletoAmountCents !== amountCents || !isDueDateUsable) {
      await provider.reviseBoleto(entry.boletoRequestId, { amountCents, dueDate });
      await prisma.paymentEntry.update({
        where: { id: entry.id },
        data: { boletoAmountCents: amountCents, boletoDueDate: parseCalendarDate(dueDate) },
      });
    }
    return { ok: true, copyPaste: entry.pixCopyPaste, digitableLine: entry.boletoDigitableLine, requestId: entry.boletoRequestId };
  }

  let requestId = isOwnBoleto ? entry.boletoRequestId : null;
  if (!requestId) {
    if (!payer) return { ok: false, reason: "boleto_failed" };
    requestId = await provider.issueBoleto({
      reference: entry.id.slice(-15),
      amountCents,
      dueDate,
      daysValidAfterDue: BOLETO_DAYS_VALID_AFTER_DUE,
      payer,
      finePercent: connection.boletoFineBps ? connection.boletoFineBps / 100 : null,
      interestMonthlyPercent: connection.boletoInterestMonthlyBps ? connection.boletoInterestMonthlyBps / 100 : null,
      discount:
        connection.boletoDiscountBps && connection.boletoDiscountDays !== null
          ? { percent: connection.boletoDiscountBps / 100, daysBeforeDue: connection.boletoDiscountDays }
          : null,
      message: entry.description,
    });
    await prisma.paymentEntry.update({
      where: { id: entry.id },
      data: {
        boletoRequestId: requestId,
        boletoStatus: "PROCESSING",
        boletoAmountCents: amountCents,
        boletoDueDate: parseCalendarDate(dueDate),
        boletoIssuedAt: new Date(),
        boletoDigitableLine: null,
        boletoBarcode: null,
        pixCopyPaste: null,
        pixProvider: connection.provider,
        pixConnectionId: connection.id,
      },
    });
  }

  const boleto = await waitForBoleto(provider, requestId);
  if (!boleto) return { ok: false, reason: "boleto_processing" };
  await applyBoletoState(entry.id, boleto);
  if (boleto.status === "FAILED") return { ok: false, reason: "boleto_failed" };
  if (!boleto.digitableLine) return { ok: false, reason: "boleto_processing" };
  return { ok: true, copyPaste: boleto.pixCopyPaste, digitableLine: boleto.digitableLine, requestId };
}

/**
 * Pede o cancelamento ao banco. O Inter aceita na hora e processa depois (conferido em
 * 2026-11-03): o código continua guardado para um pagamento que chegue antes ainda ser
 * reconhecido (vira "a identificar", sinal de pagamento em dobro); o aviso de cancelado o solta.
 */
export async function cancelEntryBoleto(params: {
  entryId: string;
  requestId: string;
  provider: BankBoletoProvider;
  reason: string;
}): Promise<void> {
  try {
    await params.provider.cancelBoleto(params.requestId, params.reason);
  } catch (error) {
    console.warn("[bank-boleto] cancel failed", { entryId: params.entryId, error: error instanceof Error ? error.message : String(error) });
    return;
  }
  await prisma.paymentEntry.updateMany({
    where: { id: params.entryId, boletoRequestId: params.requestId },
    data: {
      boletoStatus: null,
      boletoDigitableLine: null,
      boletoBarcode: null,
      boletoAmountCents: null,
      boletoDueDate: null,
      pixCopyPaste: null,
    },
  });
}
