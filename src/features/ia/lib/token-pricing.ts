/**
 * Tabela de preço por token dos LLMs usados no NASA. Valores em USD por 1.000
 * tokens (input e output cobrados separado em todos os providers).
 *
 * ⚠️ CONFERIR ANTES DE USAR PARA DECISÃO DE PREÇO.
 * Os modelos marcados com `// conferir` foram adicionados em 2026-09-18 a partir
 * de valores de referência, sem checagem nas páginas oficiais. Antes de basear
 * preço de plano nestes números, confira em:
 *   - OpenAI:    https://openai.com/api/pricing/
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - Google:    https://ai.google.dev/pricing
 * Enquanto não conferidos, o custo apurado a partir deles é ESTIMADO, não MEDIDO
 * (ver docs/BILLING_ARCHITECTURE.md §0).
 *
 * Por que a tabela mora no código e não no banco: preço errado no código é um
 * diff visível em revisão; preço errado no banco é invisível. O câmbio, que é o
 * número que de fato varia, mora em `RouterPaymentSettings` (spec 0021, D-5).
 */

export interface ModelPricing {
  /** USD por 1.000 input tokens */
  inputPer1k: number;
  /** USD por 1.000 output tokens */
  outputPer1k: number;
  /** USD por 1.000 tokens lidos de cache, quando o provider cobra diferente. */
  cachedInputPer1k?: number;
}

/**
 * Match exato OU prefix-match — `gpt-4o-mini-2024-07-18` casa com `gpt-4o-mini`.
 * Reduz manutenção em snapshot de versão.
 */
const PRICING: Record<string, ModelPricing> = {
  // ── OpenAI ────────────────────────────────────────────────────
  "gpt-4.1": { inputPer1k: 0.002, outputPer1k: 0.008 }, // conferir
  "gpt-4.1-mini": { inputPer1k: 0.0004, outputPer1k: 0.0016 }, // conferir
  "gpt-4.1-nano": { inputPer1k: 0.0001, outputPer1k: 0.0004 }, // conferir
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
  "gpt-4": { inputPer1k: 0.03, outputPer1k: 0.06 },
  "gpt-3.5-turbo": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  "o1-preview": { inputPer1k: 0.015, outputPer1k: 0.06 },
  "o1-mini": { inputPer1k: 0.003, outputPer1k: 0.012 },

  // ── Anthropic ────────────────────────────────────────────────
  "claude-opus-4": { inputPer1k: 0.015, outputPer1k: 0.075 }, // conferir
  "claude-sonnet-4": { inputPer1k: 0.003, outputPer1k: 0.015 }, // conferir
  "claude-haiku-4": { inputPer1k: 0.001, outputPer1k: 0.005 }, // conferir
  "claude-3-5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-5-haiku": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-3-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },

  // ── Google ───────────────────────────────────────────────────
  "gemini-2.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.01 }, // conferir
  "gemini-2.5-flash-lite": { inputPer1k: 0.0001, outputPer1k: 0.0004 }, // conferir
  "gemini-2.5-flash": { inputPer1k: 0.0003, outputPer1k: 0.0025 }, // conferir
  "gemini-2.0-flash-lite": { inputPer1k: 0.000075, outputPer1k: 0.0003 }, // conferir
  "gemini-2.0-flash": { inputPer1k: 0.0001, outputPer1k: 0.0004 },
  "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
  "gemini-1.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
};

/**
 * Casa modelId com a tabela. Estratégia: exato → longest-prefix.
 * Devolve null pra modelos desconhecidos (UI mostra "—" no custo).
 */
export function getPricing(
  modelId: string | null | undefined,
): ModelPricing | null {
  if (!modelId) return null;
  const direct = PRICING[modelId];
  if (direct) return direct;
  const candidates = Object.keys(PRICING)
    .filter((key) => modelId.startsWith(key))
    .sort((left, right) => right.length - left.length);
  return candidates[0] ? PRICING[candidates[0]] : null;
}

/** De onde veio o preço aplicado. `unknown` = modelo fora da tabela. */
export type CostPriceSource = "table" | "unknown";

export interface CostBreakdown {
  usd: number;
  source: CostPriceSource;
}

/**
 * Calcula custo USD de uma chamada. Tokens vêm em valor absoluto.
 *
 * Devolve a origem junto com o valor de propósito: modelo fora da tabela
 * custaria "zero" em silêncio, e zero é indistinguível de "de graça" na hora de
 * apurar margem. Quem grava o custo deve persistir `source` junto.
 */
export function calculateCost(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
): CostBreakdown {
  const pricing = getPricing(modelId);
  if (!pricing) return { usd: 0, source: "unknown" };

  const billedInputTokens = Math.max(inputTokens - cachedTokens, 0);
  const cachedRate = pricing.cachedInputPer1k ?? pricing.inputPer1k;

  const usd =
    (billedInputTokens / 1000) * pricing.inputPer1k +
    (cachedTokens / 1000) * cachedRate +
    (outputTokens / 1000) * pricing.outputPer1k;

  return { usd, source: "table" };
}

/**
 * @deprecated Use `calculateCost`, que informa se o modelo tinha preço.
 * Mantida porque telas antigas já consomem o número solto.
 */
export function calculateCostUsd(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  return calculateCost(modelId, inputTokens, outputTokens).usd;
}

/**
 * Câmbio de fallback. O valor vigente mora em `RouterPaymentSettings.usdToBrlRate`
 * e deve ser lido por `getUsdToBrlRate()` em `@/features/stars/lib/metering/fx`.
 * Este número só é usado quando não há acesso ao banco no ponto da conversão.
 */
export const FALLBACK_USD_TO_BRL = 5.5;

export function toBrl(usd: number, rate: number = FALLBACK_USD_TO_BRL): number {
  return usd * rate;
}

export function formatBrl(brl: number): string {
  return brl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTokens(total: number): string {
  if (total < 1000) return total.toString();
  if (total < 1_000_000) return `${(total / 1000).toFixed(1)}K`;
  return `${(total / 1_000_000).toFixed(2)}M`;
}
