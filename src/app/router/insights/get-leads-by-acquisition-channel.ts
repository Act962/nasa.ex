import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getLeadsByAcquisitionChannel = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/acquisition-channels",
    summary: "Get lead count grouped by acquisition source (channel)",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const { trackingId, startDate, endDate } = input;

      const dateFilter =
        startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {};

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: { organizationId: org.id },
        ...dateFilter,
      };

      // Total por canal
      const bySource = await prisma.lead.groupBy({
        by: ["source"],
        where: baseWhere,
        _count: { id: true },
      });

      // Conversão por canal (WON)
      const wonBySource = await prisma.lead.groupBy({
        by: ["source"],
        where: {
          ...baseWhere,
          currentAction: "WON",
        },
        _count: { id: true },
      });

      const wonMap = Object.fromEntries(
        wonBySource.map((r) => [r.source, r._count.id]),
      );
      const total = bySource.reduce((acc, r) => acc + r._count.id, 0);

      const sourceLabels: Record<string, string> = {
        DEFAULT: "Manual",
        WHATSAPP: "WhatsApp",
        FORM: "Formulário",
        AGENDA: "Agenda",
        OTHER: "Outro",
      };

      const channels = bySource.map((row) => {
        const count = row._count.id;
        const won = wonMap[row.source] ?? 0;
        const conversionRate =
          count > 0 ? parseFloat(((won / count) * 100).toFixed(2)) : 0;
        return {
          source: row.source,
          label: sourceLabels[row.source] ?? row.source,
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
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
