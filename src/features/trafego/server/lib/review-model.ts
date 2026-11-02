import "server-only";

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import prisma from "@/lib/prisma";
import { resolveAnthropicApiKey } from "@/lib/anthropic-key";
import { readIntegrationApiKey } from "@/features/integrations/lib/integration-api-key";
import { loadTrafegoSettings } from "./trafego-settings";
import { recordTrafegoAiUsage, type TrafegoAiFeature } from "./record-trafego-ai-usage";

/**
 * Modelo de IA do trafeGO (análise do criativo, textos e correção de anúncio). Principal: Claude Haiku
 * pela chave da agência ou da plataforma. Reserva: OpenAI da agência ou da plataforma, quando não há chave
 * da Anthropic. Nunca a chave da empresa cliente: o uso é cobrado em Stars.
 */

const ANTHROPIC_MODEL_ID = "claude-haiku-4-5-20251001";
const OPENAI_FALLBACK_MODEL_ID = "gpt-4.1-mini";

export interface ReviewModel {
  model: LanguageModel;
  provider: "anthropic" | "openai";
  /** Id curto para o registro de uso de IA. */
  usageModelId: string;
  isAgencyKey: boolean;
}

async function resolveAgencyOpenAiKey(agencyOrganizationId: string): Promise<string | null> {
  const integration = await prisma.platformIntegration.findFirst({
    where: { organizationId: agencyOrganizationId, platform: "OPENAI", isActive: true },
    select: { config: true },
  });
  return readIntegrationApiKey(integration?.config as Record<string, unknown> | null);
}

export async function resolveReviewModel(): Promise<ReviewModel | null> {
  const settings = await loadTrafegoSettings().catch(() => null);
  const agencyId = settings?.agencyOrganizationId ?? null;

  const agencyAnthropicKey = agencyId ? await resolveAnthropicApiKey(agencyId).catch(() => null) : null;
  const anthropicKey = agencyAnthropicKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (anthropicKey) {
    return {
      model: createAnthropic({ apiKey: anthropicKey })(ANTHROPIC_MODEL_ID),
      provider: "anthropic",
      usageModelId: "claude-haiku-4-5",
      isAgencyKey: anthropicKey !== process.env.ANTHROPIC_API_KEY,
    };
  }

  const agencyOpenAiKey = agencyId ? await resolveAgencyOpenAiKey(agencyId).catch(() => null) : null;
  const openAiKey = agencyOpenAiKey ?? process.env.OPENAI_API_KEY ?? null;
  if (!openAiKey) return null;
  return {
    model: createOpenAI({ apiKey: openAiKey })(OPENAI_FALLBACK_MODEL_ID),
    provider: "openai",
    usageModelId: OPENAI_FALLBACK_MODEL_ID,
    isAgencyKey: openAiKey !== process.env.OPENAI_API_KEY,
  };
}

export async function recordReviewUsage(
  reviewModel: ReviewModel,
  feature: TrafegoAiFeature,
  usage: Parameters<typeof recordTrafegoAiUsage>[0]["usage"],
) {
  await recordTrafegoAiUsage({
    feature,
    provider: reviewModel.provider,
    modelId: reviewModel.usageModelId,
    usage,
    isAgencyKey: reviewModel.isAgencyKey,
  });
}
