import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";
import prisma from "@/lib/prisma";
import { buildScopeWhere } from "./segment-rules";

// Os 9 indicadores do "Auditar Lead" somados no painel de /contatos
// (spec 0035). Só entram leads já auditados; o recorte é o mesmo dos
// segmentos (funil, tags e período).

export const leadMetricsSummary = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z
      .object({
        trackingId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        dateField: z.enum(["createdAt", "lastInboundAt"]).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .optional(),
  )
  .handler(async ({ input, context }) => {
    const leadScope = {
      tracking: {
        organizationId: context.org.id,
        participants: { some: { userId: context.user.id } },
      },
      ...buildScopeWhere(input),
    };
    const where = { lead: leadScope };

    const [aggregate, byInterest] = await Promise.all([
      prisma.leadMetrics.aggregate({
        where,
        _count: { _all: true },
        _sum: { purchasesCount: true },
        _avg: {
          purchasePotential: true,
          interactionsPerMonth: true,
          avgAttendanceSeconds: true,
          interactionLossRate: true,
          avgResponseSeconds: true,
          qualityScore: true,
          resolutionRate: true,
        },
      }),
      prisma.leadMetrics.groupBy({ by: ["interestLevel"], where, _count: { _all: true } }),
    ]);

    const round = (value: number | null) => (value === null ? null : Math.round(value));
    const interestCounts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const row of byInterest) interestCounts[row.interestLevel] = row._count._all;

    return {
      auditedLeads: aggregate._count._all,
      purchasePotential: round(aggregate._avg.purchasePotential) ?? 0,
      interestCounts,
      purchasesCount: aggregate._sum.purchasesCount ?? 0,
      interactionsPerMonth: round(aggregate._avg.interactionsPerMonth) ?? 0,
      avgAttendanceSeconds: round(aggregate._avg.avgAttendanceSeconds),
      interactionLossRate: round(aggregate._avg.interactionLossRate) ?? 0,
      avgResponseSeconds: round(aggregate._avg.avgResponseSeconds),
      qualityScore: round(aggregate._avg.qualityScore),
      resolutionRate: round(aggregate._avg.resolutionRate),
    };
  });
