import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getLeadsByAttendant = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/leads-by-attendant",
    summary:
      "Get lead distribution and won/lost stats grouped by responsible user",
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

      // Agrupar leads por responsável
      const leadsGrouped = await prisma.lead.groupBy({
        by: ["responsibleId", "currentAction"],
        where: baseWhere,
        _count: { id: true },
      });

      // Buscar dados dos usuários responsáveis
      const responsibleIds = [
        ...new Set(
          leadsGrouped.map((l) => l.responsibleId).filter(Boolean) as string[],
        ),
      ];

      const users = await prisma.user.findMany({
        where: { id: { in: responsibleIds } },
        select: { id: true, name: true, email: true, image: true },
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      // Consolidar por responsável
      const consolidatedMap: Record<
        string,
        {
          responsible: (typeof users)[0] | null;
          total: number;
          won: number;
          lost: number;
          active: number;
          conversionRate: number;
        }
      > = {};

      for (const row of leadsGrouped) {
        const key = row.responsibleId ?? "__unassigned__";
        if (!consolidatedMap[key]) {
          consolidatedMap[key] = {
            responsible: row.responsibleId
              ? (userMap[row.responsibleId] ?? null)
              : null,
            total: 0,
            won: 0,
            lost: 0,
            active: 0,
            conversionRate: 0,
          };
        }
        consolidatedMap[key].total += row._count.id;
        if (row.currentAction === "WON")
          consolidatedMap[key].won += row._count.id;
        if (row.currentAction === "LOST")
          consolidatedMap[key].lost += row._count.id;
        if (row.currentAction === "ACTIVE")
          consolidatedMap[key].active += row._count.id;
      }

      // Calcular taxa de conversão por atendente
      const result = Object.values(consolidatedMap).map((entry) => {
        const closed = entry.won + entry.lost;
        entry.conversionRate =
          closed > 0 ? parseFloat(((entry.won / closed) * 100).toFixed(2)) : 0;
        return entry;
      });

      return {
        attendants: result.sort((a, b) => b.total - a.total),
        unassignedCount: consolidatedMap["__unassigned__"]?.total ?? 0,
      };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
