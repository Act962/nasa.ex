import "server-only";

import prisma from "@/lib/prisma";
import { parseCalendarDate } from "@/features/payment/lib/dates";

// Lançamentos que provavelmente são o mesmo documento (spec 0014, RF-9):
// mesmo número de documento, ou mesmo valor no mesmo vencimento.

export interface PossibleDuplicateEntry {
  entryId: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: string;
}

export async function findPossibleDuplicateEntries(params: {
  organizationId: string;
  documentNumber: string | null;
  amountCents: number | null;
  /** "AAAA-MM-DD" */
  dueDate: string | null;
}): Promise<PossibleDuplicateEntry[]> {
  const conditions: Array<Record<string, unknown>> = [];

  if (params.documentNumber && params.documentNumber.trim().length >= 3) {
    conditions.push({
      documentNumber: { equals: params.documentNumber.trim(), mode: "insensitive" },
    });
  }
  if (params.amountCents && params.dueDate) {
    const dueDate = parseCalendarDate(params.dueDate);
    const dayStart = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    conditions.push({ amount: params.amountCents, dueDate: { gte: dayStart, lte: dayEnd } });
  }
  if (conditions.length === 0) return [];

  const rows = await prisma.paymentEntry.findMany({
    where: {
      organizationId: params.organizationId,
      status: { not: "CANCELLED" },
      OR: conditions,
    },
    select: { id: true, description: true, amount: true, dueDate: true, status: true },
    orderBy: { dueDate: "desc" },
    take: 5,
  });

  return rows.map((row) => ({
    entryId: row.id,
    description: row.description,
    amountCents: row.amount,
    dueDate: row.dueDate.toISOString().slice(0, 10),
    status: row.status,
  }));
}
