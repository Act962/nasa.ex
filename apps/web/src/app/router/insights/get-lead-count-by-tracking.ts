import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getLeadCountByTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/leads-count",
    summary: "Get total lead count for a tracking, grouped by status",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
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

      const [total, byStatus, byAction] = await Promise.all([
        // Total de leads
        prisma.lead.count({
          where: baseWhere,
        }),

        // Por status
        prisma.lead.groupBy({
          by: ["statusId"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por ação (ACTIVE, WON, LOST, DELETED)
        prisma.lead.groupBy({
          by: ["currentAction"],
          where: baseWhere,
          _count: { id: true },
        }),
      ]);

      // Enriquecer statusId com nome e cor
      const statuses = await prisma.status.findMany({
        where: {
          ...(trackingId
            ? { trackingId }
            : { tracking: { organizationId: org.id } }),
        },
        select: { id: true, name: true, color: true },
      });

      const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

      const byStatusEnriched = byStatus.map((row) => ({
        status: statusMap[row.statusId] ?? {
          id: row.statusId,
          name: "Unknown",
          color: null,
        },
        count: row._count.id,
      }));

      return {
        total,
        byStatus: byStatusEnriched,
        byAction: byAction.map((row) => ({
          action: row.currentAction,
          count: row._count.id,
        })),
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
