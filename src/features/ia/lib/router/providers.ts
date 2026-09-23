import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

import prisma from "@/lib/prisma";

/**
 * Registro de provedores de IA.
 *
 * Generaliza o que `resolve-extraction-model.ts` já fazia bem para o financeiro:
 * chave da organização antes da nossa, e lista ordenada em vez de um modelo só.
 */

export type AiProviderId = "openai" | "google" | "anthropic";

export const AI_PROVIDER_IDS: readonly AiProviderId[] = [
  "openai",
  "google",
  "anthropic",
];

const INTEGRATION_PLATFORM: Record<AiProviderId, string> = {
  openai: "OPENAI",
  google: "GEMINI",
  anthropic: "ANTHROPIC",
};

const ENV_KEYS: Record<AiProviderId, string[]> = {
  openai: ["OPENAI_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY", "GEMINI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

export type KeySource = "organization" | "env";

export interface ProviderKey {
  apiKey: string;
  source: KeySource;
}

export function envKeyFor(provider: AiProviderId): string | null {
  for (const name of ENV_KEYS[provider]) {
    const value = process.env[name];
    if (value) return value;
  }
  return null;
}

export function buildLanguageModel(
  provider: AiProviderId,
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

/**
 * Chaves cadastradas pela organização em /integrations. Uma consulta só — o
 * roteador pode tentar mais de um provedor na mesma requisição.
 *
 * Quando a chave é da organização, quem paga o provedor é ela: o registro de
 * custo marca isso e o custo para nós fica zero.
 */
export async function loadOrganizationKeys(
  organizationId: string,
): Promise<Partial<Record<AiProviderId, ProviderKey>>> {
  const integrations = await prisma.platformIntegration.findMany({
    where: {
      organizationId,
      isActive: true,
      platform: { in: Object.values(INTEGRATION_PLATFORM) as never },
    },
    select: { platform: true, config: true },
  });

  const keys: Partial<Record<AiProviderId, ProviderKey>> = {};
  for (const integration of integrations) {
    const apiKey = (integration.config as Record<string, unknown> | null)?.apiKey;
    if (typeof apiKey !== "string" || apiKey.length === 0) continue;

    const provider = AI_PROVIDER_IDS.find(
      (candidate) => INTEGRATION_PLATFORM[candidate] === integration.platform,
    );
    if (provider) keys[provider] = { apiKey, source: "organization" };
  }
  return keys;
}
