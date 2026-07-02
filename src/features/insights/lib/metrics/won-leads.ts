import "server-only";
import prisma from "@/lib/prisma";

/**
 * Cálculo de leads ganhos/perdidos + taxa de conversão + motivos de ganho de
 * um tracking/org. Fonte de verdade única, consumida pela procedure
 * `insights.getWonLeads` (página) e pela tool do Astro (WhatsApp).
 */

export interface WonLeadsResult {
  wonCount: number;
  lostCount: number;
  conversionRate: number;
  wonByReason: Array<{
    reason: { id: string; name: string; type: string } | null;
    count: number;
  }>;
}

export interface ComputeWonLeadsArgs {
  organizationId: string;
  trackingId?: string;
  startDate?: Date;
  endDate?: Date;
}

export async function computeWonLeads(
  args: ComputeWonLeadsArgs,
): Promise<WonLeadsResult> {
  const { organizationId, trackingId, startDate, endDate } = args;

  const closedAtFilter =
    startDate || endDate
      ? {
          closedAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const baseWhere = {
    ...(trackingId ? { trackingId } : {}),
    tracking: { organizationId },
  };

  const [wonLeads, wonByReason, lostLeads] = await Promise.all([
    prisma.lead.count({
      where: { ...baseWhere, currentAction: "WON", ...closedAtFilter },
    }),
    prisma.leadHistory.groupBy({
      by: ["reasonId"],
      where: {
        lead: baseWhere,
        action: "WON",
        ...(startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      _count: { id: true },
    }),
    prisma.lead.count({
      where: { ...baseWhere, currentAction: "LOST", ...closedAtFilter },
    }),
  ]);

  const reasonIds = wonByReason
    .map((row) => row.reasonId)
    .filter(Boolean) as string[];
  const reasons = await prisma.winLossReason.findMany({
    where: { id: { in: reasonIds } },
    select: { id: true, name: true, type: true },
  });
  const reasonMap = Object.fromEntries(reasons.map((reason) => [reason.id, reason]));

  const totalClosed = wonLeads + lostLeads;
  const conversionRate = totalClosed > 0 ? (wonLeads / totalClosed) * 100 : 0;

  return {
    wonCount: wonLeads,
    lostCount: lostLeads,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    wonByReason: wonByReason.map((row) => ({
      reason: row.reasonId ? (reasonMap[row.reasonId] ?? null) : null,
      count: row._count.id,
    })),
  };
}
