import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getSoldThisMonth = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/reports/insights/sold-this-month",
    summary: "Get leads won this month vs last month with daily breakdown",
  })
  .input(
    z.object({
      trackingId: z.string().optional(),
      // Permite passar um mês de referência; padrão = mês atual
      referenceMonth: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .optional(), // formato: "2024-03"
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { org } = context;
      const { trackingId, referenceMonth } = input;

      const now = referenceMonth
        ? new Date(`${referenceMonth}-01`)
        : new Date();
      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
      const endOfCurrentMonth = new Date(
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

      const baseWhere = {
        lead: {
          ...(trackingId ? { trackingId } : {}),
          tracking: { organizationId: org.id },
        },
        action: "WON" as const,
      };

      const [currentMonthWon, lastMonthWon, dailyBreakdown] = await Promise.all(
        [
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

          // Breakdown diário do mês atual (raw query para agrupar por dia)
          prisma.$queryRaw<{ day: Date; count: bigint }[]>`
          SELECT
            DATE_TRUNC('day', lh.created_at) AS day,
            COUNT(lh.id)::bigint AS count
          FROM lead_history lh
          JOIN leads l ON l.id = lh.lead_id
          JOIN tracking t ON t.id = l.tracking_id
          WHERE
            t.organization_id = ${org.id}
            AND (${trackingId}::text IS NULL OR l.tracking_id = ${trackingId})
            AND lh.action = 'WON'
            AND lh.created_at >= ${startOfCurrentMonth}
            AND lh.created_at <= ${endOfCurrentMonth}
          GROUP BY DATE_TRUNC('day', lh.created_at)
          ORDER BY day ASC
        `,
        ],
      );

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
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
