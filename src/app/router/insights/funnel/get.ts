import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../../middlewares/auth";
import { requireOrgMiddleware } from "../../../middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Funil visual de leads por etapa do tracking. Retorna lista ordenada por
 * `Status.order` com:
 *  - count: leads atualmente nessa etapa
 *  - avgTimeInStage: tempo médio (horas) que os leads passaram na etapa
 *    (calculado via `lastStatusChangeAt` para os leads atualmente nela)
 *  - dropoffFromPrevious: % de queda em relação à etapa anterior (decimal 0-100)
 */
export const getFunnel = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/insights/funnel",
    summary: "Funil visual de leads por etapa do tracking",
  })
  .input(
    z.object({
      trackingId: z.string(),
      organizationIds: z.array(z.string()).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const { org } = context;
    const orgIds =
      input.organizationIds && input.organizationIds.length > 0
        ? input.organizationIds
        : [org.id];

    // Verifica que o tracking pertence a uma das orgs solicitadas
    const tracking = await prisma.tracking.findFirst({
      where: { id: input.trackingId, organizationId: { in: orgIds } },
      select: { id: true, name: true },
    });
    if (!tracking) throw errors.NOT_FOUND;

    const statuses = await prisma.status.findMany({
      where: { trackingId: input.trackingId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, color: true, order: true },
    });

    const dateFilter =
      input.startDate || input.endDate
        ? {
            createdAt: {
              ...(input.startDate ? { gte: new Date(input.startDate) } : {}),
              ...(input.endDate ? { lte: new Date(input.endDate) } : {}),
            },
          }
        : {};

    const grouped = await prisma.lead.groupBy({
      by: ["statusId"],
      where: {
        trackingId: input.trackingId,
        currentAction: "ACTIVE",
        isActive: true,
        ...dateFilter,
      },
      _count: { id: true },
    });

    const countByStatus = Object.fromEntries(
      grouped.map((r) => [r.statusId, r._count.id]),
    );

    // Tempo médio em etapa = média de (now - lastStatusChangeAt) para leads
    // atualmente naquela etapa. Para leads que nunca mudaram de etapa, usa
    // createdAt como referência.
    const leadsForAvg = await prisma.lead.findMany({
      where: {
        trackingId: input.trackingId,
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
    for (const l of leadsForAvg) {
      const ref = (l.lastStatusChangeAt ?? l.createdAt).getTime();
      const hours = (now - ref) / (1000 * 60 * 60);
      const cur = sumByStatus.get(l.statusId) ?? { sum: 0, n: 0 };
      cur.sum += hours;
      cur.n += 1;
      sumByStatus.set(l.statusId, cur);
    }

    const stages = statuses.map((s, i) => {
      const count = countByStatus[s.id] ?? 0;
      const agg = sumByStatus.get(s.id);
      const avgTimeHours = agg && agg.n > 0 ? agg.sum / agg.n : 0;
      return {
        statusId: s.id,
        name: s.name,
        color: s.color,
        order: s.order,
        count,
        avgTimeHours: Math.round(avgTimeHours * 10) / 10,
        dropoffFromPrevious: 0, // computado abaixo
        dropoffPercent: 0,
      };
    });

    for (let i = 1; i < stages.length; i++) {
      const prev = stages[i - 1].count;
      const curr = stages[i].count;
      const drop = prev - curr;
      stages[i].dropoffFromPrevious = drop;
      stages[i].dropoffPercent =
        prev > 0 ? Math.round(((drop / prev) * 100) * 10) / 10 : 0;
    }

    return {
      tracking: { id: tracking.id, name: tracking.name },
      stages,
      total: stages.reduce((a, s) => a + s.count, 0),
    };
  });
