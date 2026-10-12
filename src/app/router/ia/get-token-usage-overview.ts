/**
 * `ia.usage.overview` — agregado de tokens e custo de IA da empresa no ciclo de 30 dias.
 *
 * Lê de `usage_event`, a mesma fonte da seção "IA da empresa" e do relatório "Consumo de IA" do
 * Insights (spec 0093, RF-7), para os três mostrarem o mesmo número. Antes lia de `AiChatRun`, que só
 * conhecia o atendimento do funil e deixava de fora o Astro e os demais recursos.
 */

import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { usageCostBrl } from "@/features/ia/lib/ai-use-groups";
import { FALLBACK_USD_TO_BRL } from "@/features/ia/lib/token-pricing";
import { loadAiDailyUsage, type AiDailyUsageRow } from "@/features/ia/server/load-ai-daily-usage";
import { isCompanyAiManager } from "@/features/ia/server/load-ai-usage";

const CYCLE_DAYS = 30;
const CYCLE_MS = CYCLE_DAYS * 24 * 60 * 60 * 1000;
const MODELS_SHOWN = 10;

interface UsageTotal {
  tokens: number;
  costBrl: number;
  runs: number;
}

function addToTotal(totals: Map<string, UsageTotal>, key: string, usageRow: AiDailyUsageRow, costBrl: number): void {
  const total = totals.get(key) ?? { tokens: 0, costBrl: 0, runs: 0 };
  totals.set(key, { tokens: total.tokens + usageRow.inputTokens + usageRow.outputTokens, costBrl: total.costBrl + costBrl, runs: total.runs + usageRow.calls });
}

const toUsd = (costBrl: number) => costBrl / FALLBACK_USD_TO_BRL;

export const getTokenUsageOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context, errors }) => {
    const organizationId = context.org.id;
    // Custo de IA da empresa inteira: só dono e admin (spec 0093). O membro comum não vê o medidor.
    if (!(await isCompanyAiManager(organizationId, context.user.id))) {
      throw errors.FORBIDDEN({ message: "Só o dono ou um administrador da empresa vê o consumo de IA." });
    }
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { createdAt: true, starsCycleStart: true } });

    const cycleStart = organization.starsCycleStart ?? organization.createdAt;
    const cycleEnd = new Date(cycleStart.getTime() + CYCLE_MS);
    const previousCycleStart = new Date(cycleStart.getTime() - CYCLE_MS);

    const [currentRows, previousRows] = await Promise.all([
      loadAiDailyUsage(organizationId, cycleStart),
      loadAiDailyUsage(organizationId, previousCycleStart, cycleStart),
    ]);

    let currentInput = 0;
    let currentOutput = 0;
    let currentCostBrl = 0;
    let totalRuns = 0;
    const byProviderTotals = new Map<string, UsageTotal>();
    const byModelTotals = new Map<string, UsageTotal>();
    const dailyTotals = new Map<string, UsageTotal>();

    for (const usageRow of currentRows) {
      const costBrl = usageCostBrl(usageRow) ?? 0;
      currentInput += usageRow.inputTokens;
      currentOutput += usageRow.outputTokens;
      currentCostBrl += costBrl;
      totalRuns += usageRow.calls;
      // Chave da empresa aparece pelo provedor; o resto é a IA mantida pela plataforma.
      addToTotal(byProviderTotals, usageRow.usingCustomKey && usageRow.provider ? usageRow.provider.toUpperCase() : "NASA_DEFAULT", usageRow, costBrl);
      addToTotal(byModelTotals, usageRow.modelId ?? "sem modelo informado", usageRow, costBrl);
      addToTotal(dailyTotals, usageRow.day, usageRow, costBrl);
    }

    let previousTokens = 0;
    let previousCostBrl = 0;
    for (const usageRow of previousRows) {
      previousTokens += usageRow.inputTokens + usageRow.outputTokens;
      previousCostBrl += usageCostBrl(usageRow) ?? 0;
    }

    const currentTokens = currentInput + currentOutput;

    return {
      cycleStart,
      cycleEnd,
      totalRuns,
      currentCycle: { inputTokens: currentInput, outputTokens: currentOutput, totalTokens: currentTokens, costUsd: toUsd(currentCostBrl), costBrl: currentCostBrl },
      previousCycle: { totalTokens: previousTokens, costUsd: toUsd(previousCostBrl), costBrl: previousCostBrl },
      trend: {
        tokensPct: previousTokens > 0 ? ((currentTokens - previousTokens) / previousTokens) * 100 : null,
        costPct: previousCostBrl > 0 ? ((currentCostBrl - previousCostBrl) / previousCostBrl) * 100 : null,
      },
      byProvider: [...byProviderTotals.entries()]
        .map(([provider, total]) => ({ provider, tokens: total.tokens, runs: total.runs, costUsd: toUsd(total.costBrl), costBrl: total.costBrl }))
        .sort((left, right) => right.costBrl - left.costBrl),
      byModel: [...byModelTotals.entries()]
        .map(([modelId, total]) => ({ modelId, tokens: total.tokens, runs: total.runs, costUsd: toUsd(total.costBrl), costBrl: total.costBrl }))
        .sort((left, right) => right.costBrl - left.costBrl)
        .slice(0, MODELS_SHOWN),
      dailyTrend: [...dailyTotals.entries()]
        .map(([day, total]) => ({ day, tokens: total.tokens, costUsd: toUsd(total.costBrl), costBrl: total.costBrl }))
        .sort((left, right) => left.day.localeCompare(right.day)),
      // Sem teto configurável ainda: o medidor mostra só o valor absoluto e a tendência.
      softBudgetTokens: null as number | null,
    };
  });
