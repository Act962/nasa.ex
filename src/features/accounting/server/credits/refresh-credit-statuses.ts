import "server-only";

import prisma from "@/lib/prisma";

// Crédito de IBS/CBS só vale depois que a compra é paga (LC 214/2025, art. 47).
// Pagou → disponível; lançamento cancelado → glosado. Crédito já usado não muda.
// TaxCredit não tem relação Prisma com o lançamento, por isso o passo duplo.

export async function refreshCreditStatuses(organizationId: string, entryIds?: string[]) {
  const openCredits = await prisma.taxCredit.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING_PAYMENT", "AVAILABLE"] },
      entryId: entryIds && entryIds.length > 0 ? { in: entryIds } : { not: null },
    },
    select: { entryId: true },
    distinct: ["entryId"],
  });
  const linkedEntryIds = openCredits
    .map((credit) => credit.entryId)
    .filter((entryId): entryId is string => Boolean(entryId));
  if (linkedEntryIds.length === 0) return { releasedCount: 0, glossedCount: 0 };

  const entries = await prisma.paymentEntry.findMany({
    where: { organizationId, id: { in: linkedEntryIds }, status: { in: ["PAID", "CANCELLED"] } },
    select: { id: true, status: true },
  });
  const paidEntryIds = entries.filter((entry) => entry.status === "PAID").map((entry) => entry.id);
  const cancelledEntryIds = entries.filter((entry) => entry.status === "CANCELLED").map((entry) => entry.id);

  const released = paidEntryIds.length
    ? await prisma.taxCredit.updateMany({
        where: { organizationId, status: "PENDING_PAYMENT", entryId: { in: paidEntryIds } },
        data: { status: "AVAILABLE" },
      })
    : { count: 0 };
  const glossed = cancelledEntryIds.length
    ? await prisma.taxCredit.updateMany({
        where: { organizationId, status: { in: ["PENDING_PAYMENT", "AVAILABLE"] }, entryId: { in: cancelledEntryIds } },
        data: { status: "GLOSSED" },
      })
    : { count: 0 };

  return { releasedCount: released.count, glossedCount: glossed.count };
}
