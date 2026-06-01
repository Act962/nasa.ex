/**
 * Overview de consumo de tokens da organização — usado pelo TokenMeter
 * do sidebar. Diferente de `getAiUsage` (que é por tracking), este é
 * **org-wide** e agrega tudo: Chatbot IA, workflow agent-mode, etc.
 *
 * Retorna:
 *   - currentCycle  : tokens + custo USD/BRL no ciclo atual (30d)
 *   - previousCycle : mesma janela no mês anterior pra calcular trend
 *   - byProvider    : breakdown OpenAI / Anthropic / Google / NASA default
 *   - byModel       : breakdown por modelId (top 10)
 *   - dailyTrend    : série diária últimos 30 dias pro mini-chart
 *
 * Ciclo: 30 dias a contar de `organization.starsCycleStart` (mesma
 * janela do Stars meter, pra a UI bater).
 *
 * Custo: derivado em-memória usando tabela `token-pricing.ts`. Não
 * persistimos `costInCents` em `AiChatRun` (ainda) pra não precisar
 * de backfill — preço sempre calculado on-read.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { calculateCostUsd, toBrl } from "@/features/ia/lib/token-pricing";

const CYCLE_DAYS = 30;

export const getTokenUsageOverview = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const orgId = context.org.id;

    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { createdAt: true, starsCycleStart: true },
    });

    const cycleStart = org.starsCycleStart ?? org.createdAt;
    const cycleEnd = new Date(
      cycleStart.getTime() + CYCLE_DAYS * 24 * 60 * 60 * 1000,
    );
    const prevCycleStart = new Date(
      cycleStart.getTime() - CYCLE_DAYS * 24 * 60 * 60 * 1000,
    );

    const baseWhere = { organizationId: orgId };

    // ── Linhas brutas dos 2 ciclos pra calcular custo em-memória ────
    //   Calcular custo em SQL exigiria CASE longo pra cada modelId.
    //   Em-memória é mais simples e rápido o suficiente até ~10k runs.
    const [currentRows, previousRows, totalRuns] = await Promise.all([
      prisma.aiChatRun.findMany({
        where: { ...baseWhere, createdAt: { gte: cycleStart } },
        select: {
          provider: true,
          modelId: true,
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          createdAt: true,
        },
      }),
      prisma.aiChatRun.findMany({
        where: {
          ...baseWhere,
          createdAt: { gte: prevCycleStart, lt: cycleStart },
        },
        select: {
          inputTokens: true,
          outputTokens: true,
          modelId: true,
        },
      }),
      prisma.aiChatRun.count({
        where: { ...baseWhere, createdAt: { gte: cycleStart } },
      }),
    ]);

    // ── Aggregates do ciclo atual ──────────────────────────────────
    let currentInput = 0;
    let currentOutput = 0;
    let currentCost = 0;

    const byProviderMap = new Map<
      string,
      { tokens: number; cost: number; runs: number }
    >();
    const byModelMap = new Map<
      string,
      { tokens: number; cost: number; runs: number }
    >();
    const dailyMap = new Map<string, { tokens: number; cost: number }>();

    for (const r of currentRows) {
      const cost = calculateCostUsd(r.modelId, r.inputTokens, r.outputTokens);
      currentInput += r.inputTokens;
      currentOutput += r.outputTokens;
      currentCost += cost;

      const providerKey = r.provider ?? "NASA_DEFAULT";
      const prov = byProviderMap.get(providerKey) ?? {
        tokens: 0,
        cost: 0,
        runs: 0,
      };
      prov.tokens += r.totalTokens;
      prov.cost += cost;
      prov.runs += 1;
      byProviderMap.set(providerKey, prov);

      const mod = byModelMap.get(r.modelId) ?? { tokens: 0, cost: 0, runs: 0 };
      mod.tokens += r.totalTokens;
      mod.cost += cost;
      mod.runs += 1;
      byModelMap.set(r.modelId, mod);

      // Bucket diário — usa UTC pra evitar drift de timezone
      const dayKey = r.createdAt.toISOString().slice(0, 10);
      const day = dailyMap.get(dayKey) ?? { tokens: 0, cost: 0 };
      day.tokens += r.totalTokens;
      day.cost += cost;
      dailyMap.set(dayKey, day);
    }

    // ── Aggregates do ciclo anterior — só pra calcular % trend ─────
    let previousTokens = 0;
    let previousCost = 0;
    for (const r of previousRows) {
      previousTokens += r.inputTokens + r.outputTokens;
      previousCost += calculateCostUsd(
        r.modelId,
        r.inputTokens,
        r.outputTokens,
      );
    }

    const currentTokens = currentInput + currentOutput;
    const tokensTrendPct =
      previousTokens > 0
        ? ((currentTokens - previousTokens) / previousTokens) * 100
        : null;
    const costTrendPct =
      previousCost > 0
        ? ((currentCost - previousCost) / previousCost) * 100
        : null;

    // ── Formatação dos breakdowns ──────────────────────────────────
    const byProvider = Array.from(byProviderMap.entries())
      .map(([provider, agg]) => ({
        provider,
        tokens: agg.tokens,
        runs: agg.runs,
        costUsd: agg.cost,
        costBrl: toBrl(agg.cost),
      }))
      .sort((a, b) => b.tokens - a.tokens);

    const byModel = Array.from(byModelMap.entries())
      .map(([modelId, agg]) => ({
        modelId,
        tokens: agg.tokens,
        runs: agg.runs,
        costUsd: agg.cost,
        costBrl: toBrl(agg.cost),
      }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 10);

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([day, agg]) => ({
        day,
        tokens: agg.tokens,
        costUsd: agg.cost,
        costBrl: toBrl(agg.cost),
      }))
      .sort((a, b) => a.day.localeCompare(b.day));

    return {
      cycleStart,
      cycleEnd,
      totalRuns,
      currentCycle: {
        inputTokens: currentInput,
        outputTokens: currentOutput,
        totalTokens: currentTokens,
        costUsd: currentCost,
        costBrl: toBrl(currentCost),
      },
      previousCycle: {
        totalTokens: previousTokens,
        costUsd: previousCost,
        costBrl: toBrl(previousCost),
      },
      trend: {
        tokensPct: tokensTrendPct,
        costPct: costTrendPct,
      },
      byProvider,
      byModel,
      dailyTrend,
      /**
       * Soft budget configurável (admin define no painel de billing).
       * null = sem teto definido → meter mostra só absoluto + trend.
       * Quando setado, vira `current / budget %` igual o Stars meter.
       * Coluna ainda não existe no schema — sempre null por enquanto.
       */
      softBudgetTokens: null as number | null,
    };
  });

// Helper só pra calmar o TS quando importarmos sem usar
export type TokenUsageOverview = Prisma.JsonValue;
