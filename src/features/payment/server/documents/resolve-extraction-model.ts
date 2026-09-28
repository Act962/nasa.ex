import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import prisma from "@/lib/prisma";

/**
 * Escolhe o modelo que lê boleto e nota fiscal (spec 0014, D-5).
 *
 * A chave vem do que a organização cadastrou em /integrations (cards OpenAI,
 * Gemini e Anthropic) e, se não houver, da variável de ambiente. A ordem de
 * preferência é por custo: para extrair doze campos de um documento
 * padronizado, o tier barato resolve, e o resultado é conferível — a linha
 * digitável recalcula valor e vencimento, e o dígito verificador do CNPJ
 * denuncia leitura errada. É isso que torna seguro usar modelo barato aqui.
 *
 * Custo aproximado por mil leituras, com 2500 tokens de entrada e 400 de
 * saída por documento (setembro de 2026):
 *   gpt-4o-mini            US$ 0,62
 *   gemini-2.5-flash-lite  US$ 0,41
 *   claude-haiku-4-5       US$ 4,50
 *
 * Override por env:
 *   ASTRO_FINANCE_EXTRACT_PROVIDER = openai | google | anthropic
 *   ASTRO_FINANCE_EXTRACT_MODEL    = id do modelo
 */

export type ExtractionProvider = "openai" | "google" | "anthropic";

/** Ordem de tentativa: o primeiro com chave é o principal, o resto é fallback. */
const PROVIDER_PREFERENCE: ExtractionProvider[] = ["openai", "google", "anthropic"];

const DEFAULT_MODEL_BY_PROVIDER: Record<ExtractionProvider, string> = {
  openai: "gpt-4o-mini",
  google: "gemini-2.5-flash-lite",
  anthropic: "claude-haiku-4-5",
};

const INTEGRATION_PLATFORM_BY_PROVIDER = {
  openai: "OPENAI",
  google: "GEMINI",
  anthropic: "ANTHROPIC",
} as const;

const ENV_KEY_BY_PROVIDER: Record<ExtractionProvider, string[]> = {
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

export interface ResolvedExtractionModel {
  model: LanguageModel;
  provider: ExtractionProvider;
  modelId: string;
  /** De onde veio a chave — aparece no aviso quando nada está configurado. */
  keySource: "integration" | "env";
}

function envKeyFor(provider: ExtractionProvider): string | null {
  for (const name of ENV_KEY_BY_PROVIDER[provider]) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

function buildModel(
  provider: ExtractionProvider,
  apiKey: string,
  modelId: string,
): LanguageModel {
  switch (provider) {
    case "openai":
      return createOpenAI({ apiKey })(modelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(modelId);
    case "anthropic":
      return createAnthropic({ apiKey })(modelId);
  }
}

function parseProviderOverride(): ExtractionProvider | null {
  const raw = process.env.ASTRO_FINANCE_EXTRACT_PROVIDER?.toLowerCase().trim();
  if (raw === "openai" || raw === "google" || raw === "anthropic") return raw;
  return null;
}

/**
 * Chaves de IA que a organização cadastrou em /integrations, por provedor.
 * Uma consulta só — a extração pode tentar mais de um provedor na mesma leitura.
 */
async function loadOrganizationKeys(
  organizationId: string,
): Promise<Partial<Record<ExtractionProvider, string>>> {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      organizationId,
      isActive: true,
      platform: { in: ["OPENAI", "GEMINI", "ANTHROPIC"] },
    },
    select: { platform: true, config: true },
  });

  const keys: Partial<Record<ExtractionProvider, string>> = {};
  for (const integration of integrations) {
    const apiKey = (integration.config as Record<string, unknown> | null)?.apiKey;
    if (typeof apiKey !== "string" || apiKey.length === 0) continue;
    if (integration.platform === "OPENAI") keys.openai = apiKey;
    if (integration.platform === "GEMINI") keys.google = apiKey;
    if (integration.platform === "ANTHROPIC") keys.anthropic = apiKey;
  }
  return keys;
}

/**
 * Devolve os modelos a tentar, em ordem. O primeiro é o principal; os demais
 * só entram se o anterior falhar (indisponibilidade, limite de taxa). Lista
 * vazia significa que nenhuma chave foi configurada.
 */
export async function resolveExtractionModels(
  organizationId: string,
): Promise<ResolvedExtractionModel[]> {
  const organizationKeys = await loadOrganizationKeys(organizationId);
  const override = parseProviderOverride();
  const modelOverride = process.env.ASTRO_FINANCE_EXTRACT_MODEL?.trim() || null;

  const order = override
    ? [override, ...PROVIDER_PREFERENCE.filter((provider) => provider !== override)]
    : PROVIDER_PREFERENCE;

  const resolved: ResolvedExtractionModel[] = [];
  for (const provider of order) {
    const integrationKey = organizationKeys[provider];
    const apiKey = integrationKey ?? envKeyFor(provider);
    if (!apiKey) continue;

    // O override de modelo vale só para o provedor principal: um id da OpenAI
    // não faz sentido no Gemini, então os fallbacks usam o default de cada um.
    const isPrimary = resolved.length === 0;
    const modelId =
      modelOverride && isPrimary ? modelOverride : DEFAULT_MODEL_BY_PROVIDER[provider];

    resolved.push({
      model: buildModel(provider, apiKey, modelId),
      provider,
      modelId,
      keySource: integrationKey ? "integration" : "env",
    });
  }

  return resolved;
}

/** Mensagem única quando nenhuma chave existe — usada pela tool e pela UI. */
export const NO_EXTRACTION_KEY_MESSAGE =
  "Nenhuma chave de IA configurada pra ler documentos. Cadastre uma em Integrações (OpenAI, Gemini ou Anthropic) — a leitura usa a mais barata disponível.";
