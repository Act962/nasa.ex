import "server-only";
import prisma from "@/lib/prisma";

/**
 * Distribuição de leads por canal de aquisição (`Lead.source`) + conversão por
 * canal. Fonte de verdade única, consumida pela procedure
 * `insights.getLeadsByAcquisitionChannel` (página) e pela tool do Astro.
 */

export interface AcquisitionChannel {
  source: string;
  label: string;
  count: number;
  won: number;
  conversionRate: number;
  percentage: number;
}

export interface AcquisitionChannelsResult {
  total: number;
  channels: AcquisitionChannel[];
}

export interface ComputeAcquisitionChannelsArgs {
  organizationId: string;
  trackingId?: string;
  startDate?: Date;
  endDate?: Date;
}

const SOURCE_LABELS: Record<string, string> = {
  DEFAULT: "Manual",
  WHATSAPP: "WhatsApp",
  FORM: "Formulário",
  AGENDA: "Agenda",
  OTHER: "Outro",
};

export async function computeAcquisitionChannels(
  args: ComputeAcquisitionChannelsArgs,
): Promise<AcquisitionChannelsResult> {
  const { organizationId, trackingId, startDate, endDate } = args;

  const dateFilter =
    startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {};

  const baseWhere = {
    ...(trackingId ? { trackingId } : {}),
    tracking: { organizationId },
    ...dateFilter,
  };

  const bySource = await prisma.lead.groupBy({
    by: ["source"],
    where: baseWhere,
    _count: { id: true },
  });

  const wonBySource = await prisma.lead.groupBy({
    by: ["source"],
    where: { ...baseWhere, currentAction: "WON" },
    _count: { id: true },
  });

  const wonMap = Object.fromEntries(
    wonBySource.map((row) => [row.source, row._count.id]),
  );
  const total = bySource.reduce(
    (accumulated, row) => accumulated + row._count.id,
    0,
  );

  const channels: AcquisitionChannel[] = bySource.map((row) => {
    const count = row._count.id;
    const won = wonMap[row.source] ?? 0;
    const conversionRate =
      count > 0 ? parseFloat(((won / count) * 100).toFixed(2)) : 0;
    return {
      source: row.source,
      label: SOURCE_LABELS[row.source] ?? row.source,
      count,
      won,
      conversionRate,
      percentage:
        total > 0 ? parseFloat(((count / total) * 100).toFixed(2)) : 0,
    };
  });

  return {
    total,
    channels: channels.sort((a, b) => b.count - a.count),
  };
}
