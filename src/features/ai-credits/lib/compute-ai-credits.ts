import "server-only";

import prisma from "@/lib/prisma";
import { estimateUsageCostUsd } from "@/features/ia/lib/token-pricing";
import {
  AI_CREDIT_CRITICAL_DAYS,
  AI_CREDIT_CRITICAL_PERCENT,
  AI_CREDIT_PROVIDERS,
  AI_CREDIT_WARNING_PERCENT,
  type AiCreditEntryView,
  type AiCreditLevel,
  type AiCreditProvider,
  type AiCreditProviderSummary,
  type AiCreditsOverview,
} from "./ai-credit-types";

/** Saldo estimado, ritmo e nível de cada provedor, por escopo (spec 0055, RF-2 a RF-5). */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LOOKBACK_DAYS = 180;
const BURN_WINDOW_DAYS = 7;
const BUSINESS_UTC_OFFSET_HOURS = 3;

/** `organizationId` nulo = conta da plataforma (chaves do .env); preenchido = chave própria da empresa. */
export interface AiCreditScope {
  organizationId: string | null;
}

interface DailyUsageRow {
  provider: string | null;
  model_id: string | null;
  day: Date;
  recorded_cost_usd: number | null;
  input_tokens_unpriced: bigint | null;
  output_tokens_unpriced: bigint | null;
  cached_tokens_unpriced: bigint | null;
  total_tokens_unpriced: bigint | null;
  total_tokens: bigint | null;
}

interface StoredCreditEntry {
  id: string;
  provider: string;
  kind: "TOPUP" | "BALANCE_SNAPSHOT" | "FREE_TIER";
  amountUsd: unknown;
  effectiveAt: Date;
  note: string | null;
}

function inferProviderFromModel(modelId: string | null): AiCreditProvider | null {
  if (!modelId) return null;
  if (modelId.startsWith("gpt") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) return "openai";
  if (modelId.startsWith("gemini")) return "google";
  if (modelId.startsWith("claude")) return "anthropic";
  return null;
}

function toKnownProvider(provider: string | null, modelId: string | null): AiCreditProvider | null {
  const normalizedProvider = provider === "gemini" ? "google" : provider;
  if (normalizedProvider && (AI_CREDIT_PROVIDERS as readonly string[]).includes(normalizedProvider)) {
    return normalizedProvider as AiCreditProvider;
  }
  return inferProviderFromModel(modelId);
}

/** O balde do SQL é o dia de São Paulo gravado como meia-noite UTC; aqui vira o instante real em que o dia começa. */
function toBusinessDayStartMs(bucketDay: Date): number {
  return bucketDay.getTime() + BUSINESS_UTC_OFFSET_HOURS * 60 * 60 * 1000;
}

function toBusinessDayKey(reference: Date): string {
  return reference.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Lançamentos do escopo. Tabela ausente (migração não aplicada) devolve `null` (RNF-2). */
export async function loadCreditEntries(scope: AiCreditScope): Promise<StoredCreditEntry[] | null> {
  try {
    const entries = await prisma.aiCreditEntry.findMany({
      where: { organizationId: scope.organizationId },
      orderBy: { effectiveAt: "asc" },
      select: { id: true, provider: true, kind: true, amountUsd: true, effectiveAt: true, note: true },
    });
    return entries as StoredCreditEntry[];
  } catch (loadError) {
    console.warn("[ai-credits] lançamentos indisponíveis (migração aplicada?):", loadError);
    return null;
  }
}

async function loadDailyUsage(scope: AiCreditScope, since: Date): Promise<DailyUsageRow[]> {
  const isPlatformScope = scope.organizationId === null;
  return prisma.$queryRaw<DailyUsageRow[]>`
    select provider, model_id, date_trunc('day', created_at - interval '3 hours') as day,
      sum(case when provider_cost_usd > 0 then provider_cost_usd else 0 end)::float8 as recorded_cost_usd,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(input_tokens, 0) end)::bigint as input_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(output_tokens, 0) end)::bigint as output_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(cached_tokens, 0) end)::bigint as cached_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(total_tokens, 0) end)::bigint as total_tokens_unpriced,
      sum(coalesce(total_tokens, 0))::bigint as total_tokens
    from usage_event
    where created_at >= ${since}
      and using_custom_key = ${!isPlatformScope}
      and (${scope.organizationId}::text is null or organization_id = ${scope.organizationId})
    group by provider, model_id, day`;
}

function costOfRow(row: DailyUsageRow, provider: AiCreditProvider): number {
  const unpricedEstimate = estimateUsageCostUsd({
    provider,
    modelId: row.model_id,
    inputTokens: Number(row.input_tokens_unpriced ?? 0),
    outputTokens: Number(row.output_tokens_unpriced ?? 0),
    cachedTokens: Number(row.cached_tokens_unpriced ?? 0),
    totalTokens: Number(row.total_tokens_unpriced ?? 0),
  });
  return Number(row.recorded_cost_usd ?? 0) + unpricedEstimate.usd;
}

function resolveLevel(summary: Pick<AiCreditProviderSummary, "balanceUsd" | "remainingPercent" | "daysLeft">): AiCreditLevel {
  if (summary.balanceUsd === null) return "unknown";
  if (summary.balanceUsd <= 0) return "critical";
  if (summary.remainingPercent !== null && summary.remainingPercent <= AI_CREDIT_CRITICAL_PERCENT) return "critical";
  if (summary.daysLeft !== null && summary.daysLeft < AI_CREDIT_CRITICAL_DAYS) return "critical";
  if (summary.remainingPercent !== null && summary.remainingPercent <= AI_CREDIT_WARNING_PERCENT) return "warning";
  return "ok";
}

function summarizeProvider(
  provider: AiCreditProvider,
  providerEntries: StoredCreditEntry[],
  costByDay: Array<{ day: Date; costUsd: number; tokens: number }>,
  now: Date,
): AiCreditProviderSummary {
  const todayKey = toBusinessDayKey(now);
  const sevenDaysAgo = new Date(now.getTime() - BURN_WINDOW_DAYS * DAY_MS);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
  const sumCostSince = (since: Date) =>
    costByDay.filter((dayCost) => toBusinessDayStartMs(dayCost.day) + DAY_MS > since.getTime()).reduce((total, dayCost) => total + dayCost.costUsd, 0);

  const spendTodayUsd = costByDay
    .filter((dayCost) => dayCost.day.toISOString().slice(0, 10) === todayKey)
    .reduce((total, dayCost) => total + dayCost.costUsd, 0);
  const spend7dUsd = sumCostSince(sevenDaysAgo);
  const spend30dUsd = sumCostSince(thirtyDaysAgo);
  const tokens30d = costByDay.filter((dayCost) => toBusinessDayStartMs(dayCost.day) + DAY_MS > thirtyDaysAgo.getTime()).reduce((total, dayCost) => total + dayCost.tokens, 0);
  const dailyBurnUsd = spend7dUsd / BURN_WINDOW_DAYS;

  const lastMarker = [...providerEntries].reverse().find((entry) => entry.kind !== "TOPUP");
  // Nível gratuito: sem crédito para acabar, então sem saldo nem aviso; o consumo continua aparecendo.
  if (lastMarker?.kind === "FREE_TIER") {
    return {
      provider,
      balanceUsd: null,
      referenceUsd: null,
      remainingPercent: null,
      spentSinceReferenceUsd: 0,
      tokensSinceReference: 0,
      spendTodayUsd,
      spend7dUsd,
      spend30dUsd,
      dailyBurnUsd,
      daysLeft: null,
      tokens30d,
      level: "free",
      lastEntryAt: lastMarker.effectiveAt.toISOString(),
      referenceStartAt: null,
    };
  }
  const lastSnapshot = lastMarker;
  const relevantEntries = lastSnapshot
    ? providerEntries.filter((entry) => entry.effectiveAt >= lastSnapshot.effectiveAt)
    : providerEntries;

  let balanceUsd: number | null = null;
  let referenceUsd: number | null = null;
  let spentSinceReferenceUsd = 0;
  let tokensSinceReference = 0;
  if (relevantEntries.length > 0) {
    const referenceStart = relevantEntries[0].effectiveAt;
    referenceUsd = relevantEntries.reduce((total, entry) => total + Number(entry.amountUsd), 0);
    // Gasto do dia do lançamento conta proporcionalmente à hora em que ele foi feito.
    for (const dayCost of costByDay) {
      const dayStart = toBusinessDayStartMs(dayCost.day);
      const dayEnd = dayStart + DAY_MS;
      if (dayEnd <= referenceStart.getTime()) continue;
      const overlapShare = (dayEnd - Math.max(dayStart, referenceStart.getTime())) / DAY_MS;
      spentSinceReferenceUsd += dayCost.costUsd * overlapShare;
      tokensSinceReference += dayCost.tokens * overlapShare;
    }
    tokensSinceReference = Math.round(tokensSinceReference);
    balanceUsd = referenceUsd - spentSinceReferenceUsd;
  }

  const remainingPercent = balanceUsd !== null && referenceUsd ? Math.max(0, (balanceUsd / referenceUsd) * 100) : null;
  const daysLeft = balanceUsd !== null && dailyBurnUsd > 0 ? Math.max(0, balanceUsd / dailyBurnUsd) : null;
  const level = resolveLevel({ balanceUsd, remainingPercent, daysLeft });

  return {
    provider,
    balanceUsd: balanceUsd === null ? null : Math.max(0, balanceUsd),
    referenceUsd,
    remainingPercent,
    spentSinceReferenceUsd,
    tokensSinceReference,
    spendTodayUsd,
    spend7dUsd,
    spend30dUsd,
    dailyBurnUsd,
    daysLeft,
    tokens30d,
    level,
    lastEntryAt: providerEntries.at(-1)?.effectiveAt.toISOString() ?? null,
    referenceStartAt: relevantEntries[0]?.effectiveAt.toISOString() ?? null,
  };
}

export async function computeAiCreditsOverview(scope: AiCreditScope, now = new Date()): Promise<AiCreditsOverview> {
  const storedEntries = await loadCreditEntries(scope);
  const entries = storedEntries ?? [];
  const earliestEntryAt = entries[0]?.effectiveAt;
  const lookbackStart = new Date(
    Math.max(
      now.getTime() - MAX_LOOKBACK_DAYS * DAY_MS,
      Math.min(now.getTime() - 31 * DAY_MS, earliestEntryAt ? earliestEntryAt.getTime() - DAY_MS : Infinity),
    ),
  );

  const usageRows = await loadDailyUsage(scope, lookbackStart);
  const costByProvider = new Map<AiCreditProvider, Map<number, { day: Date; costUsd: number; tokens: number }>>();
  for (const row of usageRows) {
    const provider = toKnownProvider(row.provider, row.model_id);
    if (!provider) continue;
    const providerDays = costByProvider.get(provider) ?? new Map();
    const dayKey = new Date(row.day).getTime();
    const dayCost = providerDays.get(dayKey) ?? { day: new Date(row.day), costUsd: 0, tokens: 0 };
    dayCost.costUsd += costOfRow(row, provider);
    dayCost.tokens += Number(row.total_tokens ?? 0);
    providerDays.set(dayKey, dayCost);
    costByProvider.set(provider, providerDays);
  }

  const providers = AI_CREDIT_PROVIDERS.map((provider) =>
    summarizeProvider(
      provider,
      entries.filter((entry) => entry.provider === provider),
      [...(costByProvider.get(provider)?.values() ?? [])],
      now,
    ),
  );

  const entryViews: AiCreditEntryView[] = [...entries].reverse().map((entry) => ({
    id: entry.id,
    provider: entry.provider as AiCreditProvider,
    kind: entry.kind,
    amountUsd: Number(entry.amountUsd),
    effectiveAt: entry.effectiveAt.toISOString(),
    note: entry.note,
  }));

  return { isLedgerAvailable: storedEntries !== null, providers, entries: entryViews };
}

export interface AiUsageBreakdownRow {
  organizationId: string;
  organizationName: string;
  appSlug: string;
  provider: AiCreditProvider;
  modelId: string;
  tokens: number;
  costUsd: number;
}

interface BreakdownQueryRow {
  organization_id: string;
  app_slug: string | null;
  provider: string | null;
  model_id: string | null;
  recorded_cost_usd: number | null;
  input_tokens_unpriced: bigint | null;
  output_tokens_unpriced: bigint | null;
  cached_tokens_unpriced: bigint | null;
  total_tokens_unpriced: bigint | null;
  total_tokens: bigint | null;
}

/** Quem gastou o crédito da plataforma nos últimos 30 dias, por empresa, App e modelo (RF-4). */
export async function computePlatformUsageBreakdown(limit = 40): Promise<AiUsageBreakdownRow[]> {
  const since = new Date(Date.now() - 30 * DAY_MS);
  const rows = await prisma.$queryRaw<BreakdownQueryRow[]>`
    select organization_id, app_slug, provider, model_id,
      sum(case when provider_cost_usd > 0 then provider_cost_usd else 0 end)::float8 as recorded_cost_usd,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(input_tokens, 0) end)::bigint as input_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(output_tokens, 0) end)::bigint as output_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(cached_tokens, 0) end)::bigint as cached_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(total_tokens, 0) end)::bigint as total_tokens_unpriced,
      sum(coalesce(total_tokens, 0))::bigint as total_tokens
    from usage_event
    where created_at >= ${since} and using_custom_key = false
    group by organization_id, app_slug, provider, model_id`;

  const pricedRows = rows.flatMap((row) => {
    const provider = toKnownProvider(row.provider, row.model_id);
    if (!provider) return [];
    return [{
      organizationId: row.organization_id,
      appSlug: row.app_slug ?? "—",
      provider,
      modelId: row.model_id ?? "—",
      tokens: Number(row.total_tokens ?? 0),
      costUsd: costOfRow(row as unknown as DailyUsageRow, provider),
    }];
  });
  const topRows = pricedRows.sort((left, right) => right.costUsd - left.costUsd).slice(0, limit);
  const organizations = await prisma.organization.findMany({
    where: { id: { in: [...new Set(topRows.map((row) => row.organizationId))] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(organizations.map((organization) => [organization.id, organization.name]));
  return topRows.map((row) => ({ ...row, organizationName: nameById.get(row.organizationId) ?? "Empresa removida" }));
}

export interface ModelUsageStats {
  provider: AiCreditProvider;
  modelId: string;
  tokensToday: number;
  tokens30d: number;
  costUsdToday: number;
  costUsd30d: number;
  /** Gasto com a chave própria desde o início do saldo atual da IA (barra contra o crédito informado). */
  ownKeyCostUsdSinceReference: number;
}

interface ModelDayUsageRow extends BreakdownQueryRow {
  day: Date;
  using_custom_key: boolean;
}

/**
 * Consumo da empresa por modelo — hoje e 30 dias (chave própria e da plataforma juntas) e, só da
 * chave própria, desde o saldo informado de cada IA (spec 0055, RF-14 e RF-17).
 */
export async function computeOrganizationModelUsage(
  organizationId: string,
  referenceStartByProvider: Partial<Record<AiCreditProvider, Date>> = {},
): Promise<ModelUsageStats[]> {
  const referenceStarts = Object.values(referenceStartByProvider).filter((start): start is Date => Boolean(start));
  const earliestReference = referenceStarts.length > 0 ? Math.min(...referenceStarts.map((start) => start.getTime())) : Infinity;
  const since = new Date(Math.max(Date.now() - MAX_LOOKBACK_DAYS * DAY_MS, Math.min(Date.now() - 30 * DAY_MS, earliestReference - DAY_MS)));
  const thirtyDaysAgoMs = Date.now() - 30 * DAY_MS;
  const todayKey = toBusinessDayKey(new Date());
  const rows = await prisma.$queryRaw<ModelDayUsageRow[]>`
    select organization_id, null::text as app_slug, provider, model_id, using_custom_key,
      date_trunc('day', created_at - interval '3 hours') as day,
      sum(case when provider_cost_usd > 0 then provider_cost_usd else 0 end)::float8 as recorded_cost_usd,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(input_tokens, 0) end)::bigint as input_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(output_tokens, 0) end)::bigint as output_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(cached_tokens, 0) end)::bigint as cached_tokens_unpriced,
      sum(case when coalesce(provider_cost_usd, 0) > 0 then 0 else coalesce(total_tokens, 0) end)::bigint as total_tokens_unpriced,
      sum(coalesce(total_tokens, 0))::bigint as total_tokens
    from usage_event
    where created_at >= ${since} and organization_id = ${organizationId}
    group by organization_id, provider, model_id, using_custom_key, day`;

  const statsByModel = new Map<string, ModelUsageStats>();
  for (const row of rows) {
    const provider = toKnownProvider(row.provider, row.model_id);
    if (!provider || !row.model_id) continue;
    const modelKey = `${provider}:${row.model_id}`;
    const stats = statsByModel.get(modelKey) ?? {
      provider,
      modelId: row.model_id,
      tokensToday: 0,
      tokens30d: 0,
      costUsdToday: 0,
      costUsd30d: 0,
      ownKeyCostUsdSinceReference: 0,
    };
    const rowCostUsd = costOfRow(row as unknown as DailyUsageRow, provider);
    const rowTokens = Number(row.total_tokens ?? 0);
    const dayStartMs = toBusinessDayStartMs(new Date(row.day));
    if (dayStartMs + DAY_MS > thirtyDaysAgoMs) {
      stats.tokens30d += rowTokens;
      stats.costUsd30d += rowCostUsd;
    }
    if (new Date(row.day).toISOString().slice(0, 10) === todayKey) {
      stats.tokensToday += rowTokens;
      stats.costUsdToday += rowCostUsd;
    }
    const referenceStart = referenceStartByProvider[provider];
    if (row.using_custom_key && referenceStart && dayStartMs + DAY_MS > referenceStart.getTime()) {
      // Dia do lançamento conta só a parte depois dele, como no saldo estimado.
      const overlapShare = (dayStartMs + DAY_MS - Math.max(dayStartMs, referenceStart.getTime())) / DAY_MS;
      stats.ownKeyCostUsdSinceReference += rowCostUsd * overlapShare;
    }
    statsByModel.set(modelKey, stats);
  }
  return [...statsByModel.values()];
}
