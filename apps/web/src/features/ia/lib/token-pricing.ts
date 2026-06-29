/**
 * Tabela de preço por token dos LLMs usados no NASA. Valores em USD
 * por 1.000 tokens (input e output cobrados separado em todos os
 * providers).
 *
 * Fonte: docs públicas de Outubro/2024
 *   - OpenAI:    https://openai.com/api/pricing/
 *   - Anthropic: https://www.anthropic.com/pricing
 *   - Google:    https://ai.google.dev/pricing
 *
 * Manter sincronizado conforme os providers reajustam (raro, mas
 * acontece). Default `gpt-4o-mini` cobre 90% das chamadas hoje
 * (Chatbot IA + workflow agent-mode default).
 *
 * Conversão USD→BRL fica num helper separado pra facilitar trocar
 * câmbio dinâmico quando integrarmos.
 */

export interface ModelPricing {
  /** USD por 1.000 input tokens */
  inputPer1k: number;
  /** USD por 1.000 output tokens */
  outputPer1k: number;
}

/**
 * Match exato OU prefix-match — `gpt-4o-mini-2024-07-18` casa com
 * `gpt-4o-mini`. Reduz manutenção em snapshot de versão.
 */
const PRICING: Record<string, ModelPricing> = {
  // ── OpenAI ────────────────────────────────────────────────────
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4-turbo": { inputPer1k: 0.01, outputPer1k: 0.03 },
  "gpt-4": { inputPer1k: 0.03, outputPer1k: 0.06 },
  "gpt-3.5-turbo": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  "o1-preview": { inputPer1k: 0.015, outputPer1k: 0.06 },
  "o1-mini": { inputPer1k: 0.003, outputPer1k: 0.012 },

  // ── Anthropic ────────────────────────────────────────────────
  "claude-3-5-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-5-haiku": { inputPer1k: 0.001, outputPer1k: 0.005 },
  "claude-3-opus": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-3-sonnet": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-3-haiku": { inputPer1k: 0.00025, outputPer1k: 0.00125 },

  // ── Google ───────────────────────────────────────────────────
  "gemini-1.5-pro": { inputPer1k: 0.00125, outputPer1k: 0.005 },
  "gemini-1.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  "gemini-2.0-flash": { inputPer1k: 0.0001, outputPer1k: 0.0004 },
};

/**
 * Casa modelId com a tabela. Estratégia: exato → longest-prefix.
 * Devolve null pra modelos desconhecidos (UI mostra "—" no custo).
 */
export function getPricing(modelId: string | null | undefined): ModelPricing | null {
  if (!modelId) return null;
  const direct = PRICING[modelId];
  if (direct) return direct;
  // Longest prefix — ex: "gpt-4o-2024-08-06" casa com "gpt-4o"
  const candidates = Object.keys(PRICING)
    .filter((k) => modelId.startsWith(k))
    .sort((a, b) => b.length - a.length);
  return candidates[0] ? PRICING[candidates[0]] : null;
}

/**
 * Calcula custo USD de uma chamada.
 * Tokens vêm em valor absoluto (não por 1k), helper faz a divisão.
 */
export function calculateCostUsd(
  modelId: string | null | undefined,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = getPricing(modelId);
  if (!p) return 0;
  return (
    (inputTokens / 1000) * p.inputPer1k +
    (outputTokens / 1000) * p.outputPer1k
  );
}

/**
 * Câmbio USD→BRL. Hardcoded por enquanto — quando integrar API de
 * câmbio (ex: Currencylayer, BCB), trocar pra função async cacheada.
 */
const USD_TO_BRL = 5.5;

export function toBrl(usd: number): number {
  return usd * USD_TO_BRL;
}

export function formatBrl(brl: number): string {
  return brl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatTokens(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}
