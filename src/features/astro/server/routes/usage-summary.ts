import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import { resolvePrimaryModel } from "@/features/ia/lib/router/resolve-model";
import { MODEL_CATALOG } from "@/features/ia/lib/router/model-catalog";
import { getPricing } from "@/features/ia/lib/token-pricing";
import { ORBITA_PLATFORM_MODEL, resolveAstroAiMode } from "@/features/astro/lib/resolve-astro-ai-mode";
import { REALTIME_VOICE_MODEL_IDS, resolveVoiceModel } from "@/features/astro/server/voice/build-voice-session-config";
import { computeAiCreditsOverview, computeOrganizationModelUsage } from "@/features/ai-credits/lib/compute-ai-credits";
import { getMonetarySettings } from "@/features/stars/lib/metering";
import { isProviderExhausted } from "@/features/ai-credits/lib/provider-exhaustion";
import { canManageAstroModelPricing, getAstroModelPricingSettings } from "@/features/ai-credits/lib/model-pricing-settings";
import { AI_CREDIT_PROVIDERS, type AiCreditProvider } from "@/features/ai-credits/lib/ai-credit-types";

/** Uso do ASTRO no ícone abaixo da caixa da Início: IA em uso, modelos, preços e saldos (spec 0055, RF-10). */

const DEFAULT_VOICE_NAME = "marin";
const TOKENS_PER_MILLION_FROM_1K = 1000;

type ProviderSource = "own" | "platform" | "none";

function toModelPrice(modelId: string, isVoice: boolean) {
  const pricing = getPricing(modelId);
  return {
    modelId,
    isVoice,
    inputPerMillionUsd: pricing ? pricing.inputPer1k * TOKENS_PER_MILLION_FROM_1K : null,
    outputPerMillionUsd: pricing ? pricing.outputPer1k * TOKENS_PER_MILLION_FROM_1K : null,
  };
}

const STANDARD_VOICE_MODEL_ID = "gpt-4o-mini-tts";

/** Modelos de texto do roteador e, na OpenAI, os modelos de voz (tempo real e econômica). */
function listProviderModels(provider: AiCreditProvider) {
  const uniqueModelIds = [...new Set(MODEL_CATALOG.filter((model) => model.provider === provider).map((model) => model.id))];
  const textModels = uniqueModelIds.map((modelId) => toModelPrice(modelId, false));
  if (provider !== "openai") return textModels;
  const voiceModels = [...REALTIME_VOICE_MODEL_IDS, STANDARD_VOICE_MODEL_ID].map((modelId) => toModelPrice(modelId, true));
  return [...textModels, ...voiceModels];
}

export const getAstroUsageSummary = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", path: "/astro/usage-summary", summary: "ASTRO usage summary for the composer meter" })
  .input(
    z
      .object({
        providerOrder: z.array(z.enum(["openai", "google", "anthropic"])).max(3).optional(),
        disabledModelIds: z.array(z.string().max(80)).max(40).optional(),
      })
      .optional(),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw errors.UNAUTHORIZED();

    const [aiMode, organizationKeys, organizationCredits, currentUser, modelPricing, canManageModelPricing] = await Promise.all([
      resolveAstroAiMode(organizationId),
      loadOrganizationKeys(organizationId),
      computeAiCreditsOverview({ organizationId }),
      prisma.user.findUnique({ where: { id: context.user.id }, select: { isSystemAdmin: true } }),
      getAstroModelPricingSettings(),
      canManageAstroModelPricing(context.user.id),
    ]);
    // Consumo por modelo é detalhe: se falhar, o ícone e o resto do painel continuam aparecendo.
    const [modelUsage, { usdToBrlRate }] = await Promise.all([
      computeOrganizationModelUsage(
        organizationId,
        Object.fromEntries(
          organizationCredits.providers
            .filter((summary) => summary.referenceStartAt)
            .map((summary) => [summary.provider, new Date(summary.referenceStartAt!)]),
        ),
      ).catch((usageError) => {
        console.warn("[astro/usage-summary] consumo por modelo indisponível:", usageError);
        return [];
      }),
      getMonetarySettings(),
    ]);

    let activeModelId: string | null = null;
    let activeProvider: string | null = null;
    try {
      const primaryModel = await resolvePrimaryModel({
        organizationId,
        tier: "SMART",
        requires: { tools: true },
        forceModelId: aiMode === "PLATFORM" ? ORBITA_PLATFORM_MODEL.modelId : process.env.ASTRO_DEFAULT_MODEL,
        preferProvider:
          aiMode === "PLATFORM" && (!input?.providerOrder?.length || input.providerOrder[0] === "openai")
            ? ORBITA_PLATFORM_MODEL.provider
            : undefined,
        providerOrder: input?.providerOrder,
        disabledModelIds: input?.disabledModelIds,
      });
      activeModelId = primaryModel.modelId;
      activeProvider = primaryModel.provider;
    } catch {
      // Nenhuma chave disponível: o ícone mostra "sem IA" em vez de quebrar a Início.
    }

    const providers = AI_CREDIT_PROVIDERS.map((provider) => {
      const source: ProviderSource = organizationKeys[provider] ? "own" : envKeyFor(provider) ? "platform" : "none";
      const credit = organizationCredits.providers.find((summary) => summary.provider === provider) ?? null;
      return {
        provider,
        source,
        isExhausted:
          source === "own"
            ? isProviderExhausted({ organizationId, provider })
            : source === "platform" && isProviderExhausted({ organizationId: null, provider }),
        models: source === "none" ? [] : listProviderModels(provider),
        ownCredit: source === "own" ? credit : null,
      };
    });

    const platformAccounts = currentUser?.isSystemAdmin
      ? (await computeAiCreditsOverview({ organizationId: null })).providers
      : null;

    return {
      aiMode,
      activeModelId,
      activeProvider,
      voice: { modelId: resolveVoiceModel(), voiceName: process.env.ASTRO_VOICE_NAME?.trim() || DEFAULT_VOICE_NAME },
      providers,
      platformAccounts,
      modelPricing,
      canManageModelPricing,
      modelUsage,
      usdToBrlRate,
      voiceOptions: {
        realtimeModelIds: [...REALTIME_VOICE_MODEL_IDS],
        standardModelId: STANDARD_VOICE_MODEL_ID,
      },
    };
  });
