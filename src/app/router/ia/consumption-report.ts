import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { MODEL_GUIDE_BY_ID } from "@/features/ia/lib/ai-model-guide";
import { findAiResourceForUsage } from "@/features/ia/lib/ai-resources";
import { reportPeriodStart, usageCostBrl } from "@/features/ia/lib/ai-use-groups";
import { loadAiDailyUsage } from "@/features/ia/server/load-ai-daily-usage";
import { isCompanyAiManager } from "@/features/ia/server/load-ai-usage";
import prisma from "@/lib/prisma";

// Relatório "Consumo de IA" do Insights (spec 0093, RF-7): recurso × modelo × quem pagou, e o gasto
// por dia. Mesma fonte (`usage_event`) e mesma conta de custo da seção "IA da empresa". Só dono e admin.

const OTHER_USES_LABEL = "Outros usos";

export const getAiConsumptionReport = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", path: "/ia/consumption-report", summary: "Consumo de IA da empresa por recurso, modelo e quem pagou" })
  .input(z.object({ period: z.enum(["7d", "30d", "90d", "month"]).default("30d") }).optional())
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    if (!(await isCompanyAiManager(organizationId, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa vê o consumo de IA." });
    }
    const period = input?.period ?? "30d";
    const since = reportPeriodStart(period);

    const [usageRows, dailyRows] = await Promise.all([
      prisma.usageEvent.groupBy({
        by: ["feature", "action", "trackingId", "modelId", "usingCustomKey"],
        where: { organizationId, createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costBrl: true, starsCharged: true, inputTokens: true, outputTokens: true },
      }),
      loadAiDailyUsage(organizationId, since),
    ]);

    const trackingIds = [...new Set(usageRows.map((usageRow) => usageRow.trackingId).filter((trackingId): trackingId is string => Boolean(trackingId)))];
    // Filtrado pela empresa: um id de funil gravado por engano não revela o nome de funil alheio.
    const trackings = trackingIds.length > 0 ? await prisma.tracking.findMany({ where: { id: { in: trackingIds }, organizationId }, select: { id: true, name: true } }) : [];
    const trackingNameById = new Map(trackings.map((tracking) => [tracking.id, tracking.name]));

    interface ReportLine {
      app: string;
      resourceLabel: string;
      trackingName: string | null;
      modelId: string | null;
      modelName: string | null;
      paidBy: "company" | "platform";
      calls: number;
      tokens: number;
      costBrl: number;
      stars: number;
      unpricedCalls: number;
    }
    const lineByKey = new Map<string, ReportLine>();
    for (const usageRow of usageRows) {
      const resource = findAiResourceForUsage(usageRow);
      const trackingName = resource?.isPerTracking && usageRow.trackingId ? (trackingNameById.get(usageRow.trackingId) ?? null) : null;
      const inputTokens = usageRow._sum.inputTokens ?? 0;
      const outputTokens = usageRow._sum.outputTokens ?? 0;
      const costBrl = usageCostBrl({
        usingCustomKey: usageRow.usingCustomKey,
        modelId: usageRow.modelId,
        inputTokens,
        outputTokens,
        costBrl: usageRow._sum.costBrl === null ? null : Number(usageRow._sum.costBrl),
      });
      const paidBy = usageRow.usingCustomKey ? "company" : "platform";
      const lineKey = [resource?.id ?? "other", trackingName ?? "", usageRow.modelId ?? "", paidBy].join("|");
      const line = lineByKey.get(lineKey) ?? {
        app: resource?.app ?? OTHER_USES_LABEL,
        resourceLabel: resource?.label ?? OTHER_USES_LABEL,
        trackingName,
        modelId: usageRow.modelId,
        modelName: usageRow.modelId ? (MODEL_GUIDE_BY_ID.get(usageRow.modelId)?.name ?? usageRow.modelId) : null,
        paidBy,
        calls: 0,
        tokens: 0,
        costBrl: 0,
        stars: 0,
        unpricedCalls: 0,
      };
      lineByKey.set(lineKey, {
        ...line,
        calls: line.calls + usageRow._count._all,
        tokens: line.tokens + inputTokens + outputTokens,
        costBrl: line.costBrl + (costBrl ?? 0),
        stars: line.stars + (usageRow._sum.starsCharged ?? 0),
        unpricedCalls: line.unpricedCalls + (costBrl === null ? usageRow._count._all : 0),
      });
    }
    const lines = [...lineByKey.values()].sort((left, right) => right.costBrl - left.costBrl || right.calls - left.calls);

    const dayTotals = new Map<string, { day: string; companyCostBrl: number; platformCostBrl: number; stars: number; calls: number }>();
    for (const dailyRow of dailyRows) {
      const total = dayTotals.get(dailyRow.day) ?? { day: dailyRow.day, companyCostBrl: 0, platformCostBrl: 0, stars: 0, calls: 0 };
      const costBrl = usageCostBrl(dailyRow) ?? 0;
      dayTotals.set(dailyRow.day, {
        day: dailyRow.day,
        companyCostBrl: total.companyCostBrl + (dailyRow.usingCustomKey ? costBrl : 0),
        platformCostBrl: total.platformCostBrl + (dailyRow.usingCustomKey ? 0 : costBrl),
        stars: total.stars + dailyRow.stars,
        calls: total.calls + dailyRow.calls,
      });
    }

    return {
      period,
      since,
      totals: {
        calls: lines.reduce((sum, line) => sum + line.calls, 0),
        costBrl: lines.reduce((sum, line) => sum + line.costBrl, 0),
        companyCostBrl: lines.filter((line) => line.paidBy === "company").reduce((sum, line) => sum + line.costBrl, 0),
        platformCostBrl: lines.filter((line) => line.paidBy === "platform").reduce((sum, line) => sum + line.costBrl, 0),
        stars: lines.reduce((sum, line) => sum + line.stars, 0),
        unpricedCalls: lines.reduce((sum, line) => sum + line.unpricedCalls, 0),
      },
      lines,
      daily: [...dayTotals.values()].sort((left, right) => left.day.localeCompare(right.day)),
    };
  });
