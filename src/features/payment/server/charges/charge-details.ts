import "server-only";

import prisma from "@/lib/prisma";
import { buildPixBrCode } from "@/features/form-records/lib/pix-br-code";
import { getPixSettings } from "@/features/form-records/server/record-pix";
import { readChargeToken } from "@/features/payment/lib/charge-link";
import { PENDING_ENTRY_STATUSES } from "@/features/payment/server/entries/entry-include";
import type { PublicChargeViewData } from "@/features/payment/components/charges/public-charge-view";

// Cobrança da spec 0115: é a própria conta a receber. O PIX usa a chave já cadastrada nas
// Propostas e Fichas, e o identificador (txid) é o id do lançamento, para a conciliação
// poder casar o recebimento depois.

export function getOpenAmountCents(entry: { amount: number; paidAmount: number }): number {
  return Math.max(entry.amount - entry.paidAmount, 0);
}

export async function buildChargePixCode(params: {
  organizationId: string;
  entryId: string;
  amountCents: number;
}): Promise<string | null> {
  if (params.amountCents <= 0) return null;
  const pixSettings = await getPixSettings(params.organizationId);
  if (!pixSettings.pixKey || !pixSettings.receiverName || !pixSettings.receiverCity) return null;
  return buildPixBrCode({
    pixKey: pixSettings.pixKey,
    receiverName: pixSettings.receiverName,
    receiverCity: pixSettings.receiverCity,
    amountCents: params.amountCents,
    transactionId: params.entryId,
  });
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
    pixCode: isOpen
      ? await buildChargePixCode({
          organizationId: entry.organizationId,
          entryId: entry.id,
          amountCents: openAmountCents,
        })
      : null,
  };
}
