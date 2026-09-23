/**
 * Gravação do registro de custo por evento (spec 0021).
 *
 * INVARIANTE: esta função nunca roda dentro da transação de débito e nunca
 * lança. Falha de telemetria não pode invalidar cobrança já persistida — é a
 * Regra 18 do CLAUDE.md, escrita em cima de um 500 real em produção.
 */

import type { UsageEventKind } from "@/generated/prisma/client";
import { calculateCost } from "@/features/ia/lib/token-pricing";
import prisma from "@/lib/prisma";
import { getMonetarySettings } from "./fx";

export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface RecordUsageInput {
  organizationId: string;
  userId?: string;
  kind: UsageEventKind;
  action: string;
  appSlug?: string;
  /** Recorte mais fino que o app, ex.: "astro.orchestrator". */
  feature?: string;

  provider?: string;
  modelId?: string;
  /** Chave do próprio cliente: o custo para nós é zero. */
  usingCustomKey?: boolean;

  tokens?: TokenUsage;
  quantity?: number;
  quantityUnit?: string;

  /** Custo já conhecido em dólar. Se ausente e houver tokens, é calculado. */
  providerCostUsd?: number;
  infraCostUsd?: number;

  starsCharged?: number;
  starTransactionId?: string;

  sessionId?: string;
  trackingId?: string;
  leadId?: string;
  requestId?: string;
  status?: "ok" | "provider_error" | "insufficient_stars" | "catalog_miss";
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

function resolveProviderCost(input: RecordUsageInput): {
  usd: number | null;
  priceSource: string;
} {
  // Chave do cliente: ele paga o provider, não nós.
  if (input.usingCustomKey) return { usd: 0, priceSource: "byo_key" };

  if (typeof input.providerCostUsd === "number") {
    return { usd: input.providerCostUsd, priceSource: "estimate" };
  }

  const tokens = input.tokens;
  if (!tokens) return { usd: null, priceSource: "unknown" };

  const inputTokens = tokens.inputTokens ?? 0;
  const outputTokens = tokens.outputTokens ?? 0;
  if (inputTokens === 0 && outputTokens === 0) {
    return { usd: null, priceSource: "unknown" };
  }

  const { usd, source } = calculateCost(
    input.modelId,
    inputTokens,
    outputTokens,
    tokens.cachedTokens ?? 0,
  );
  return source === "unknown"
    ? { usd: null, priceSource: "unknown" }
    : { usd, priceSource: "table" };
}

export async function recordUsageEvent(
  input: RecordUsageInput,
): Promise<void> {
  try {
    const { usdToBrlRate, starPriceBrl } = await getMonetarySettings();
    const { usd, priceSource } = resolveProviderCost(input);

    const totalUsd = (usd ?? 0) + (input.infraCostUsd ?? 0);
    const starsCharged = input.starsCharged ?? 0;

    await prisma.usageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        kind: input.kind,
        action: input.action,
        appSlug: input.appSlug ?? input.action.split("_")[0],
        feature: input.feature,
        provider: input.provider,
        modelId: input.modelId,
        usingCustomKey: input.usingCustomKey ?? false,
        inputTokens: input.tokens?.inputTokens,
        outputTokens: input.tokens?.outputTokens,
        cachedTokens: input.tokens?.cachedTokens,
        totalTokens: input.tokens?.totalTokens,
        quantity: input.quantity,
        quantityUnit: input.quantityUnit,
        providerCostUsd: usd,
        infraCostUsd: input.infraCostUsd,
        costBrl: usd === null ? null : totalUsd * usdToBrlRate,
        usdToBrlRate,
        priceSource,
        starsCharged,
        starPriceBrl,
        revenueBrl: starsCharged * starPriceBrl,
        starTransactionId: input.starTransactionId,
        sessionId: input.sessionId,
        trackingId: input.trackingId,
        leadId: input.leadId,
        requestId: input.requestId,
        status: input.status ?? "ok",
        latencyMs: input.latencyMs,
        metadata: input.metadata as never,
      },
    });
  } catch (error) {
    console.warn(
      `[stars] falha ao registrar custo de "${input.action}" — cobrança preservada.`,
      error,
    );
  }
}
