import "server-only";
import prisma from "@/lib/prisma";

// Spec 0104, RF-4: "apto" = nenhuma conta a receber vencida do lead no financeiro do Órbita.
// Conta PENDING já vencida entra mesmo antes do cron marcar OVERDUE.

export type LeadCreditStatus = {
  isEligible: boolean;
  overdueCount: number;
  overdueTotalCents: number;
};

function startOfTodayInBrasilia(now: Date): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  return new Date(`${day}T00:00:00-03:00`);
}

export async function getLeadCreditStatus(params: { organizationId: string; leadId: string; now?: Date }): Promise<LeadCreditStatus> {
  const startOfToday = startOfTodayInBrasilia(params.now ?? new Date());
  const overdueEntries = await prisma.paymentEntry.findMany({
    where: {
      organizationId: params.organizationId,
      leadId: params.leadId,
      type: "RECEIVABLE",
      OR: [{ status: "OVERDUE" }, { status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: startOfToday } }],
    },
    select: { amount: true, paidAmount: true },
  });
  const overdueTotalCents = overdueEntries.reduce((sum, entry) => sum + Math.max(entry.amount - entry.paidAmount, 0), 0);
  return { isEligible: overdueEntries.length === 0, overdueCount: overdueEntries.length, overdueTotalCents };
}

/** Marca como OVERDUE as contas a receber vencidas (RF-5). Devolve quantas mudaram. */
export async function markOverdueReceivables(now = new Date()): Promise<number> {
  const result = await prisma.paymentEntry.updateMany({
    where: { type: "RECEIVABLE", status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: startOfTodayInBrasilia(now) } },
    data: { status: "OVERDUE" },
  });
  return result.count;
}
