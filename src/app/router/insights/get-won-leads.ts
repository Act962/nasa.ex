import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWonLeads = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/won-leads",
    summary: "Get won leads count and details for a tracking",
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
              closedAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {};

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: { organizationId: org.id },
      };

      const [wonLeads, wonByReason, lostLeads] = await Promise.all([
        // Total de ganhos
        prisma.lead.count({
          where: {
            ...baseWhere,
            currentAction: "WON",
            ...dateFilter,
          },
        }),

        // Ganhos agrupados por motivo de ganho
        prisma.leadHistory.groupBy({
          by: ["reasonId"],
          where: {
            lead: baseWhere,
            action: "WON",
            ...(startDate || endDate
              ? {
                  createdAt: {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                  },
                }
              : {}),
          },
          _count: { id: true },
        }),

        // Total de perdas (para calcular taxa de conversão)
        prisma.lead.count({
          where: {
            ...baseWhere,
            currentAction: "LOST",
            ...dateFilter,
          },
        }),
      ]);

      // Enriquecer reasonId com nome
      const reasonIds = wonByReason
        .map((r) => r.reasonId)
        .filter(Boolean) as string[];
      const reasons = await prisma.winLossReason.findMany({
        where: { id: { in: reasonIds } },
        select: { id: true, name: true, type: true },
      });
      const reasonMap = Object.fromEntries(reasons.map((r) => [r.id, r]));

      const totalClosed = wonLeads + lostLeads;
      const conversionRate =
        totalClosed > 0 ? (wonLeads / totalClosed) * 100 : 0;

      return {
        wonCount: wonLeads,
        lostCount: lostLeads,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        wonByReason: wonByReason.map((row) => ({
          reason: row.reasonId ? (reasonMap[row.reasonId] ?? null) : null,
          count: row._count.id,
        })),
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
