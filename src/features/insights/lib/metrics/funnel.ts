import "server-only";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Cálculo do funil de leads por etapa de um tracking. Fonte de verdade única,
 * consumida pela procedure `insights.getFunnel` (página) e pela tool do Astro
 * (`get_funnel`, WhatsApp). Mantenha a lógica aqui — não duplique nos callers.
 */

export interface FunnelStage {
  statusId: string;
  name: string;
  color: string | null;
  /** `Status.order` é Decimal(20,10) no schema — preservado como veio do banco. */
  order: Prisma.Decimal;
  count: number;
  avgTimeHours: number;
  dropoffFromPrevious: number;
  dropoffPercent: number;
}

export interface FunnelResult {
  tracking: { id: string; name: string };
  stages: FunnelStage[];
  total: number;
}

export interface ComputeFunnelArgs {
  /** Orgs que podem ser donas do tracking (ownership check). */
  organizationIds: string[];
  trackingId: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Retorna `null` quando o tracking não existe ou não pertence a nenhuma das
 * orgs informadas — o caller decide se vira NOT_FOUND (procedure) ou mensagem
 * amigável (tool).
 */
export async function computeFunnel(
  args: ComputeFunnelArgs,
): Promise<FunnelResult | null> {
  const { organizationIds, trackingId, startDate, endDate } = args;

  const tracking = await prisma.tracking.findFirst({
    where: { id: trackingId, organizationId: { in: organizationIds } },
    select: { id: true, name: true },
  });
  if (!tracking) return null;

  const statuses = await prisma.status.findMany({
    where: { trackingId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, order: true },
  });

  const dateFilter =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const grouped = await prisma.lead.groupBy({
    by: ["statusId"],
    where: {
      trackingId,
      currentAction: "ACTIVE",
      isActive: true,
      ...dateFilter,
    },
    _count: { id: true },
  });

  const countByStatus = Object.fromEntries(
    grouped.map((row) => [row.statusId, row._count.id]),
  );

  const leadsForAvg = await prisma.lead.findMany({
    where: {
      trackingId,
      currentAction: "ACTIVE",
      isActive: true,
      ...dateFilter,
    },
    select: {
      statusId: true,
      lastStatusChangeAt: true,
      createdAt: true,
    },
  });

  const sumByStatus = new Map<string, { sum: number; n: number }>();
  const now = Date.now();
  for (const lead of leadsForAvg) {
    const reference = (lead.lastStatusChangeAt ?? lead.createdAt).getTime();
    const hours = (now - reference) / (1000 * 60 * 60);
    const current = sumByStatus.get(lead.statusId) ?? { sum: 0, n: 0 };
    current.sum += hours;
    current.n += 1;
    sumByStatus.set(lead.statusId, current);
  }

  const stages: FunnelStage[] = statuses.map((status) => {
    const count = countByStatus[status.id] ?? 0;
    const agg = sumByStatus.get(status.id);
    const avgTimeHours = agg && agg.n > 0 ? agg.sum / agg.n : 0;
    return {
      statusId: status.id,
      name: status.name,
      color: status.color,
      order: status.order,
      count,
      avgTimeHours: Math.round(avgTimeHours * 10) / 10,
      dropoffFromPrevious: 0,
      dropoffPercent: 0,
    };
  });

  for (let i = 1; i < stages.length; i++) {
    const previousCount = stages[i - 1]!.count;
    const currentCount = stages[i]!.count;
    const drop = previousCount - currentCount;
    stages[i]!.dropoffFromPrevious = drop;
    stages[i]!.dropoffPercent =
      previousCount > 0
        ? Math.round((drop / previousCount) * 100 * 10) / 10
        : 0;
  }

  return {
    tracking: { id: tracking.id, name: tracking.name },
    stages,
    total: stages.reduce((accumulated, stage) => accumulated + stage.count, 0),
  };
}
