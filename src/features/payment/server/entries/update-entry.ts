import "server-only";

import prisma from "@/lib/prisma";
import { parseCalendarDate } from "@/features/payment/lib/dates";
import { ENTRY_INCLUDE } from "./entry-include";

export interface UpdatePaymentEntryPatch {
  description?: string;
  amount?: number;
  dueDate?: string;
  status?: "PENDING_APPROVAL" | "PENDING" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELLED";
  paidAmount?: number;
  paidAt?: string | null;
  categoryId?: string | null;
  costCenterId?: string | null;
  contactId?: string | null;
  accountId?: string | null;
  notes?: string | null;
  documentNumber?: string | null;
  installmentTotal?: number | null;
}

export type UpdateEntryResult =
  | { ok: true; entry: Awaited<ReturnType<typeof applyUpdate>> }
  | { ok: false; reason: "not_found"; message: string };

async function applyUpdate(entryId: string, patch: UpdatePaymentEntryPatch) {
  const { dueDate, paidAt, ...data } = patch;
  return prisma.paymentEntry.update({
    where: { id: entryId },
    data: {
      ...data,
      ...(dueDate ? { dueDate: parseCalendarDate(dueDate) } : {}),
      ...(paidAt !== undefined ? { paidAt: paidAt ? new Date(paidAt) : null } : {}),
    },
    include: ENTRY_INCLUDE,
  });
}

export async function updatePaymentEntryRecord(params: {
  organizationId: string;
  entryId: string;
  patch: UpdatePaymentEntryPatch;
}): Promise<UpdateEntryResult> {
  const existing = await prisma.paymentEntry.findFirst({
    where: { id: params.entryId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, reason: "not_found", message: "Lançamento não encontrado" };
  }
  const entry = await applyUpdate(params.entryId, params.patch);
  return { ok: true, entry };
}
