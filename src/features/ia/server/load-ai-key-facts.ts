import "server-only";
import prisma from "@/lib/prisma";
import { last4 } from "@/lib/crypto";
import { resolveVoiceModel } from "@/features/astro/server/voice/build-voice-session-config";
import { envKeyFor, loadOrganizationKeys } from "@/features/ia/lib/router/providers";
import type { AiProviderName } from "@/features/ia/lib/ai-resources";
import type { AiKeyFacts, FunnelAiFacts } from "@/features/ia/lib/describe-ai-resource";

// Fatos sobre as chaves de IA de uma empresa, para a tela "IA da empresa" (spec 0093). As chaves são
// lidas só para saber se existem e qual é o final delas; nada daqui devolve a chave inteira.

const DEFAULT_FUNNEL_MODEL_ID = "gpt-4.1-mini";
const PROVIDERS: AiProviderName[] = ["openai", "google", "anthropic"];
const FUNNEL_PROVIDER: Record<string, AiProviderName> = { OPENAI: "openai", GOOGLE: "google", ANTHROPIC: "anthropic" };

export async function loadAiKeyFacts(organizationId: string): Promise<{ facts: AiKeyFacts; funnels: FunnelAiFacts[] }> {
  const [organizationKeys, plannerWithKey, trackings] = await Promise.all([
    loadOrganizationKeys(organizationId),
    prisma.nasaPlanner.findFirst({ where: { organizationId, anthropicApiKey: { not: null } }, select: { id: true } }),
    prisma.tracking.findMany({
      where: { organizationId },
      select: { id: true, name: true, aiSettings: { select: { aiProvider: true, aiModelId: true, aiApiKey: true, aiApiKeyLast4: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const companyKeys: AiKeyFacts["companyKeys"] = {};
  for (const provider of PROVIDERS) {
    const organizationKey = organizationKeys[provider];
    if (organizationKey) companyKeys[provider] = { last4: last4(organizationKey.apiKey) };
  }

  return {
    facts: {
      companyKeys,
      platformKeys: { openai: Boolean(envKeyFor("openai")), google: Boolean(envKeyFor("google")), anthropic: Boolean(envKeyFor("anthropic")) },
      hasPlannerAnthropicKey: Boolean(plannerWithKey),
      defaultFunnelModelId: process.env.ASTRO_DEFAULT_MODEL ?? DEFAULT_FUNNEL_MODEL_ID,
      realtimeVoiceModelId: resolveVoiceModel(null),
    },
    funnels: trackings.map((tracking) => ({
      trackingId: tracking.id,
      trackingName: tracking.name,
      provider: tracking.aiSettings?.aiProvider ? (FUNNEL_PROVIDER[tracking.aiSettings.aiProvider] ?? null) : null,
      modelId: tracking.aiSettings?.aiModelId ?? null,
      hasOwnKey: Boolean(tracking.aiSettings?.aiApiKey),
      keyLast4: tracking.aiSettings?.aiApiKeyLast4 ?? null,
    })),
  };
}
