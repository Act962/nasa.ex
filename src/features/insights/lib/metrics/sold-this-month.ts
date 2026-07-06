import "server-only";
import prisma from "@/lib/prisma";

/**
 * Cálculo de leads ganhos no mês atual vs mês anterior + breakdown diário.
 * Fonte de verdade única, consumida pela procedure `insights.getSoldThisMonth`
 * (página) e pela tool do Astro (WhatsApp).
 */

export interface SoldThisMonthResult {
  currentMonth: { label: string; count: number };
  lastMonth: { label: string; count: number };
  growthRate: number | null;
  dailyBreakdown: Array<{ day: Date; count: number }>;
}

export interface ComputeSoldThisMonthArgs {
  organizationId: string;
  trackingId?: string;
  /** Mês de referência no formato "YYYY-MM". Default = mês atual. */
  referenceMonth?: string;
}

export async function computeSoldThisMonth(
  args: ComputeSoldThisMonthArgs,
): Promise<SoldThisMonthResult> {
  const { organizationId, trackingId, referenceMonth } = args;

  const now = referenceMonth ? new Date(`${referenceMonth}-01`) : new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  );

  const baseWhere = {
    lead: {
      ...(trackingId ? { trackingId } : {}),
      tracking: { organizationId },
    },
    action: "WON" as const,
  };

  const [currentMonthWon, lastMonthWon, dailyBreakdown] = await Promise.all([
    prisma.leadHistory.count({
      where: {
        ...baseWhere,
        createdAt: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
      },
    }),
    prisma.leadHistory.count({
      where: {
        ...baseWhere,
        createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
      },
    }),
    prisma.$queryRaw<{ day: Date; count: bigint }[]>`
          SELECT
            DATE_TRUNC('day', lh.created_at) AS day,
            COUNT(lh.id)::bigint AS count
          FROM lead_history lh
          JOIN leads l ON l.id = lh.lead_id
          JOIN tracking t ON t.id = l.tracking_id
          WHERE
            t.organization_id = ${organizationId}
            AND (${trackingId}::text IS NULL OR l.tracking_id = ${trackingId})
            AND lh.action = 'WON'
            AND lh.created_at >= ${startOfCurrentMonth}
            AND lh.created_at <= ${endOfCurrentMonth}
          GROUP BY DATE_TRUNC('day', lh.created_at)
          ORDER BY day ASC
        `,
  ]);

  const growthRate =
    lastMonthWon > 0
      ? (((currentMonthWon - lastMonthWon) / lastMonthWon) * 100).toFixed(2)
      : null;

  return {
    currentMonth: {
      label: startOfCurrentMonth.toLocaleString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      count: currentMonthWon,
    },
    lastMonth: {
      label: startOfLastMonth.toLocaleString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      count: lastMonthWon,
    },
    growthRate: growthRate ? parseFloat(growthRate) : null,
    dailyBreakdown: dailyBreakdown.map((row) => ({
      day: row.day,
      count: Number(row.count),
    })),
  };
}
