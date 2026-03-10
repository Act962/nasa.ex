import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getTrackingDashboardReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/dashboard",
    summary: "Get a full consolidated report for a tracking dashboard",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      tagIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const { trackingId, startDate, endDate, tagIds } = input;

      const dateFilter =
        startDate || endDate
          ? {
              createdAt: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              },
            }
          : {};

      const tagFilter =
        tagIds && tagIds.length > 0
          ? {
              leadTags: {
                some: {
                  tagId: { in: tagIds },
                },
              },
            }
          : {};

      const baseWhere = {
        ...(trackingId ? { trackingId } : {}),
        tracking: { organizationId: org.id },
        ...dateFilter,
        ...tagFilter,
      };

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const startOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfLastMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      const [
        totalLeads,
        wonLeads,
        lostLeads,
        activeLeads,
        soldThisMonthRes,
        soldLastMonthRes,
        bySource,
        byStatus,
        byResponsible,
        byTag,
      ] = await Promise.all([
        prisma.lead.count({ where: baseWhere }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "WON" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "LOST" } }),
        prisma.lead.count({ where: { ...baseWhere, currentAction: "ACTIVE" } }),

        // Valor Vendido esse mês
        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            history: {
              some: {
                action: "WON",
                createdAt: { gte: startOfMonth, lte: endOfMonth },
              },
            },
          },
          _sum: { amount: true },
        }),

        // Valor Vendido mês passado
        prisma.lead.aggregate({
          where: {
            ...baseWhere,
            history: {
              some: {
                action: "WON",
                createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
              },
            },
          },
          _sum: { amount: true },
        }),

        // Por canal
        prisma.lead.groupBy({
          by: ["source"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por status
        prisma.lead.groupBy({
          by: ["statusId"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por responsável
        prisma.lead.groupBy({
          by: ["responsibleId", "currentAction"],
          where: baseWhere,
          _count: { id: true },
        }),

        // Por tag
        prisma.leadTag.groupBy({
          by: ["tagId"],
          where: {
            lead: baseWhere,
          },
          _count: { id: true },
          orderBy: { _count: { id: "desc" } },
          take: 10,
        }),
      ]);

      const soldThisMonth = Number(soldThisMonthRes._sum.amount || 0);
      const soldLastMonth = Number(soldLastMonthRes._sum.amount || 0);

      // Enriquecer dados
      const statuses = await prisma.status.findMany({
        where: {
          ...(trackingId
            ? { trackingId }
            : { tracking: { organizationId: org.id } }),
        },
        select: { id: true, name: true, color: true },
      });
      const statusMap = Object.fromEntries(statuses.map((s) => [s.id, s]));

      const responsibleIds = [
        ...new Set(
          byResponsible.map((r) => r.responsibleId).filter(Boolean) as string[],
        ),
      ];
      const users = await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, image: true },
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      const topTagIds = byTag.map((t) => t.tagId);
      const tags = await prisma.tag.findMany({
        where: { id: { in: topTagIds } },
        select: { id: true, name: true, color: true },
      });
      const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]));

      // Consolidar responsáveis
      const responsibleConsolidated: Record<
        string,
        { user: (typeof users)[0] | null; won: number; total: number }
      > = {};
      for (const row of byResponsible) {
        const key = row.responsibleId ?? "__unassigned__";
        if (!responsibleConsolidated[key]) {
          responsibleConsolidated[key] = {
            user: row.responsibleId
              ? (userMap[row.responsibleId] ?? null)
              : null,
            won: 0,
            total: 0,
          };
        }
        responsibleConsolidated[key].total += row._count.id;
        if (row.currentAction === "WON")
          responsibleConsolidated[key].won += row._count.id;
      }

      const closedTotal = wonLeads + lostLeads;
      const monthGrowth =
        soldLastMonth > 0
          ? parseFloat(
              (((soldThisMonth - soldLastMonth) / soldLastMonth) * 100).toFixed(
                2,
              ),
            )
          : null;

      return {
        summary: {
          totalLeads,
          activeLeads,
          wonLeads,
          lostLeads,
          conversionRate:
            closedTotal > 0
              ? parseFloat(((wonLeads / closedTotal) * 100).toFixed(2))
              : 0,
          soldThisMonth,
          soldLastMonth,
          monthGrowthRate: monthGrowth,
        },
        byStatus: byStatus.map((row) => ({
          status: statusMap[row.statusId] ?? {
            id: row.statusId,
            name: "Unknown",
            color: null,
          },
          count: row._count.id,
        })),
        byChannel: bySource.map((row) => ({
          source: row.source,
          count: row._count.id,
        })),
        byAttendant: Object.entries(responsibleConsolidated).map(
          ([key, val]) => ({
            responsible: val.user,
            isUnassigned: key === "__unassigned__",
            total: val.total,
            won: val.won,
          }),
        ),
        topTags: byTag.map((row) => ({
          tag: tagMap[row.tagId] ?? {
            id: row.tagId,
            name: "Unknown",
            color: null,
          },
          count: row._count.id,
        })),
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
