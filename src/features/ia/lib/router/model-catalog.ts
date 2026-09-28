import { getPricing } from "@/features/ia/lib/token-pricing";
import type { AiProviderId } from "./providers";

/**
 * Catálogo de modelos: o que cada um sabe fazer e em que nível ele entra.
 *
 * O preço NÃO é duplicado aqui — vem de `token-pricing.ts`, que continua sendo
 * a fonte única. Dois arquivos que precisam concordar sobre valor acabam
 * discordando.
 */

/**
 * Nível do ASTRO. O cliente nunca escolhe GPT, Gemini ou Claude: escolhe (ou
 * o sistema escolhe por ele) entre rápido, esperto e profundo.
 */
export type AstroTier = "FAST" | "SMART" | "DEEP";

export interface ModelCapabilities {
  vision: boolean;
  tools: boolean;
  json: boolean;
  contextWindow: number;
}

export interface CatalogModel {
  id: string;
  provider: AiProviderId;
  tier: AstroTier;
  capabilities: ModelCapabilities;
}

const FULL: ModelCapabilities = {
  vision: true,
  tools: true,
  json: true,
  contextWindow: 128_000,
};

/**
 * A ordem dentro de cada nível É a preferência, e é deliberada — o primeiro de
 * cada nível é o modelo que o ASTRO já usava, para que ligar o roteador não
 * troque o modelo de ninguém em silêncio. Os seguintes só entram quando não há
 * chave do anterior.
 *
 * Por que a ordem não sai do preço: a tabela de custo está marcada
 * `// conferir` em `token-pricing.ts`, sem checagem nas páginas dos provedores.
 * Escolher modelo por número não confiável é pior do que escolher por uma
 * ordem que alguém decidiu e assinou. Quando os preços forem conferidos, esta
 * ordem pode ser revista — como decisão, não como efeito colateral.
 */
export const MODEL_CATALOG: CatalogModel[] = [
  // ── FAST — respostas curtas, classificação, extração simples ────────────
  { id: "gpt-4.1-nano", provider: "openai", tier: "FAST", capabilities: { ...FULL, contextWindow: 1_000_000 } },
  { id: "gemini-2.5-flash-lite", provider: "google", tier: "FAST", capabilities: { ...FULL, contextWindow: 1_000_000 } },
  { id: "claude-haiku-4-5", provider: "anthropic", tier: "FAST", capabilities: { ...FULL, contextWindow: 200_000 } },

  // ── SMART — uso do dia a dia, com ferramentas ───────────────────────────
  { id: "gpt-4o-mini", provider: "openai", tier: "SMART", capabilities: FULL },
  { id: "gemini-2.5-flash", provider: "google", tier: "SMART", capabilities: { ...FULL, contextWindow: 1_000_000 } },
  { id: "claude-haiku-4-5", provider: "anthropic", tier: "SMART", capabilities: { ...FULL, contextWindow: 200_000 } },

  // ── DEEP — raciocínio longo, várias ferramentas encadeadas ──────────────
  // `gpt-4o` primeiro: é o que o ASTRO usava para consulta complexa.
  { id: "gpt-4o", provider: "openai", tier: "DEEP", capabilities: FULL },
  { id: "claude-sonnet-4-5", provider: "anthropic", tier: "DEEP", capabilities: { ...FULL, contextWindow: 200_000 } },
  { id: "gemini-2.5-pro", provider: "google", tier: "DEEP", capabilities: { ...FULL, contextWindow: 1_000_000 } },
];

export interface CapabilityRequirements {
  vision?: boolean;
  tools?: boolean;
  json?: boolean;
  minContextWindow?: number;
}

export function satisfies(
  model: CatalogModel,
  requires?: CapabilityRequirements,
): boolean {
  if (!requires) return true;
  if (requires.vision && !model.capabilities.vision) return false;
  if (requires.tools && !model.capabilities.tools) return false;
  if (requires.json && !model.capabilities.json) return false;
  if (
    requires.minContextWindow &&
    model.capabilities.contextWindow < requires.minContextWindow
  ) {
    return false;
  }
  return true;
}

/**
 * Custo estimado de mil tokens de entrada mais mil de saída.
 *
 * Serve para EXIBIR e comparar — não para escolher. A ordem de preferência é a
 * declarada no catálogo, pelo motivo explicado acima.
 */
export function blendedCostPer1k(modelId: string): number {
  const pricing = getPricing(modelId);
  if (!pricing) return Number.POSITIVE_INFINITY;
  return pricing.inputPer1k + pricing.outputPer1k;
}

export function modelsForTier(tier: AstroTier): CatalogModel[] {
  return MODEL_CATALOG.filter((model) => model.tier === tier);
}
