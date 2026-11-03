import "server-only";

import prisma from "@/lib/prisma";
import { buildPixBrCode } from "@/features/form-records/lib/pix-br-code";
import { getPixSettings } from "@/features/form-records/server/record-pix";
import { resolveEntryBankCharge, type BankPixFallbackReason } from "@/features/payment/server/bank-charges/charge-pix";
import type { BoletoSkipReason } from "@/features/payment/server/bank-charges/charge-boleto";
import { buildChargeUrl, readChargeToken } from "@/features/payment/lib/charge-link";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import type { PublicChargeViewData } from "@/features/payment/components/charges/public-charge-view";

// Cobrança da spec 0115: é a própria conta a receber. O PIX usa a chave já cadastrada nas
// Propostas e Fichas, e o identificador (txid) é o id do lançamento, para a conciliação
// poder casar o recebimento depois.

export function getOpenAmountCents(entry: { amount: number; paidAmount: number }): number {
  return Math.max(entry.amount - entry.paidAmount, 0);
}

/** P-3 da spec 0130: a página da cobrança espera o banco no máximo isto antes do PIX estático. */
const BANK_PIX_PAGE_TIMEOUT_MS = 3_000;

export interface ChargePix {
  code: string | null;
  /** `BANK` = gerado no banco, com baixa automática; `STATIC` = chave da empresa. */
  source: "BANK" | "STATIC" | null;
  bankFallbackReason: BankPixFallbackReason | null;
  /** Boleto com PIX do banco (spec 0133); `code` é o PIX dele. */
  boleto: { digitableLine: string } | null;
  /** Boleto ligado, mas esta conta saiu só com PIX: por quê. */
  boletoSkippedReason: BoletoSkipReason | null;
}

interface ChargePixParams {
  organizationId: string;
  entryId: string;
  amountCents: number;
  bankTimeoutMs?: number;
}

/**
 * PIX da cobrança: o do banco conectado (com baixa automática, spec 0130) ou, se não houver
 * banco ou ele falhar, o estático montado com a chave da empresa (RF-8).
 */
export async function resolveChargePix(params: ChargePixParams): Promise<ChargePix> {
  const empty = { code: null, source: null, bankFallbackReason: null, boleto: null, boletoSkippedReason: null };
  if (params.amountCents <= 0) return empty;
  const bankCharge = await resolveEntryBankCharge({
    organizationId: params.organizationId,
    entryId: params.entryId,
    amountCents: params.amountCents,
    timeoutMs: params.bankTimeoutMs ?? BANK_PIX_PAGE_TIMEOUT_MS,
  });
  if (bankCharge.ok && bankCharge.kind === "BOLETO") {
    return {
      ...empty,
      code: bankCharge.copyPaste,
      source: bankCharge.copyPaste ? "BANK" : null,
      boleto: { digitableLine: bankCharge.digitableLine },
    };
  }
  if (bankCharge.ok) {
    return { ...empty, code: bankCharge.copyPaste, source: "BANK", boletoSkippedReason: bankCharge.boletoSkippedReason };
  }

  // Boleto sendo gerado no banco: nada de PIX estático, que não teria baixa automática e
  // deixaria duas formas de pagar a mesma conta. A página pede para atualizar.
  const isBoletoProcessing =
    bankCharge.reason === "boleto_processing" ||
    (bankCharge.reason === "timeout" &&
      (await prisma.paymentEntry.count({
        where: { id: params.entryId, organizationId: params.organizationId, boletoStatus: "PROCESSING" },
      })) > 0);
  if (isBoletoProcessing) return { ...empty, bankFallbackReason: "boleto_processing" };

  const bankFallbackReason = bankCharge.reason === "no_connection" ? null : bankCharge.reason;
  const pixSettings = await getPixSettings(params.organizationId);
  if (!pixSettings.pixKey || !pixSettings.receiverName || !pixSettings.receiverCity) {
    return { ...empty, bankFallbackReason };
  }
  const code = buildPixBrCode({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    receiverCity: pixSettings.receiverCity,
    amountCents: params.amountCents,
    transactionId: params.entryId,
  });
  return { ...empty, code, source: "STATIC", bankFallbackReason };
}

export async function buildChargePixCode(params: ChargePixParams): Promise<string | null> {
  return (await resolveChargePix(params)).code;
}

/** Total vencido do mesmo cliente em outras contas a receber (`{{outras_pendencias}}`). */
export async function sumOtherOverdueReceivablesCents(entry: {
  id: string;
  organizationId: string;
  contactId: string | null;
  leadId: string | null;
}): Promise<number> {
  const customerFilters = [
    ...(entry.contactId ? [{ contactId: entry.contactId }] : []),
    ...(entry.leadId ? [{ leadId: entry.leadId }] : []),
  ];
  if (customerFilters.length === 0) return 0;
  const otherEntries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: entry.organizationId,
      type: "RECEIVABLE",
      status: "OVERDUE",
      id: { not: entry.id },
      OR: customerFilters,
    },
    select: { amount: true, paidAmount: true },
    take: 100,
  });
  return otherEntries.reduce((total, otherEntry) => total + getOpenAmountCents(otherEntry), 0);
}

export async function loadPublicCharge(token: string): Promise<PublicChargeViewData | null> {
  const tokenData = readChargeToken(token);
  if (!tokenData) return null;

  const entry = await prisma.paymentEntry.findFirst({
    where: { id: tokenData.entryId, organizationId: tokenData.organizationId, type: "RECEIVABLE" },
    select: {
      id: true,
      organizationId: true,
      description: true,
      amount: true,
      paidAmount: true,
      dueDate: true,
      paidAt: true,
      status: true,
      installmentCurrent: true,
      installmentTotal: true,
      contact: { select: { name: true } },
      lead: { select: { name: true } },
      organization: { select: { name: true, logo: true } },
    },
  });
  if (!entry || entry.status === "PENDING_APPROVAL") return null;

  const isOpen = (PENDING_ENTRY_STATUSES as readonly string[]).includes(entry.status);
  const openAmountCents = getOpenAmountCents(entry);
  const chargePix = isOpen
    ? await resolveChargePix({ organizationId: entry.organizationId, entryId: entry.id, amountCents: openAmountCents })
    : null;
  const status: PublicChargeViewData["status"] =
    entry.status === "PAID"
      ? "PAID"
      : entry.status === "CANCELLED"
        ? "CANCELLED"
        : entry.status === "OVERDUE"
          ? "OVERDUE"
          : "OPEN";

  return {
    organizationName: entry.organization.name,
    organizationLogo: entry.organization.logo,
    description: entry.description,
    customerName: entry.contact?.name ?? entry.lead?.name ?? null,
    amountCents: entry.amount,
    openAmountCents,
    dueDate: entry.dueDate,
    status,
    paidAt: entry.paidAt,
    installmentLabel:
      entry.installmentCurrent && entry.installmentTotal
        ? `Parcela ${entry.installmentCurrent} de ${entry.installmentTotal}`
        : null,
    pixCode: chargePix?.code ?? null,
    boletoDigitableLine: chargePix?.boleto?.digitableLine ?? null,
    boletoPdfUrl: chargePix?.boleto ? `${buildChargeUrl(entry.organizationId, entry.id)}/boleto.pdf` : null,
    isBoletoProcessing: chargePix?.bankFallbackReason === "boleto_processing",
  };
}
