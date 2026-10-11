import { MODEL_GUIDE, USE_RECOMMENDATIONS, type AiUse, type ModelBand } from "./ai-model-guide";
import { BAND_USE_RESOURCE_ID, SELECTOR_WIRED_RESOURCE_IDS, type AiBandUse, type AiPreferences } from "./ai-preferences";
import type { AiProviderName, AiResource } from "./ai-resources";
import { describeAiResource, type AiKeyFacts, type AiResourceStatus, type FunnelAiFacts } from "./describe-ai-resource";

// Decisão do seletor único (spec 0093, etapa 2, RF-17): parte do que o recurso faz hoje e aplica só o
// que o dono ou admin ligou nas preferências. Puro, para a tela e o servidor decidirem igual e para
// um script conferir. Com as preferências vazias devolve exatamente o comportamento de hoje.

const PROVIDER_LABEL: Record<AiProviderName, string> = { openai: "OpenAI", google: "Gemini", anthropic: "Anthropic" };
const PROVIDER_OF_GUIDE_LABEL: Record<string, AiProviderName> = { OpenAI: "openai", Google: "google", Anthropic: "anthropic" };
const NON_CHAT_MODEL_PATTERN = /realtime|transcribe|tts|whisper/;

function bandUseOf(resourceId: string): AiBandUse | null {
  const entry = Object.entries(BAND_USE_RESOURCE_ID).find(([, bandResourceId]) => bandResourceId === resourceId);
  return entry ? (entry[0] as AiBandUse) : null;
}

/** Modelo de uma faixa num provedor: o recomendado para aquele uso, ou o primeiro de texto da faixa. */
export function modelForBand(use: AiUse, provider: AiProviderName, band: ModelBand): string | null {
  const isFromProvider = (modelId: string) => PROVIDER_OF_GUIDE_LABEL[MODEL_GUIDE.find((entry) => entry.modelId === modelId)?.providerLabel ?? ""] === provider;
  const recommended = USE_RECOMMENDATIONS.find((recommendation) => recommendation.use === use)?.options.find((option) => option.band === band && isFromProvider(option.modelId));
  if (recommended) return recommended.modelId;
  return MODEL_GUIDE.find((entry) => entry.band === band && PROVIDER_OF_GUIDE_LABEL[entry.providerLabel] === provider && !NON_CHAT_MODEL_PATTERN.test(entry.modelId))?.modelId ?? null;
}

export interface CompanyKeyOverride {
  shouldUseCompanyKey: boolean;
  modelId: string;
}

/**
 * Dado o provedor e o modelo que o recurso usaria hoje na chave da plataforma, diz se a chave da
 * empresa entra no lugar e com qual modelo. É a mesma conta para a tela e para o servidor.
 */
export function pickCompanyKeyOverride(input: { resourceId: string; provider: AiProviderName; modelId: string; preferences: AiPreferences; hasCompanyKey: boolean }): CompanyKeyOverride {
  const isOn = SELECTOR_WIRED_RESOURCE_IDS.has(input.resourceId) && input.preferences.companyKeyResources.includes(input.resourceId) && input.hasCompanyKey;
  if (!isOn) return { shouldUseCompanyKey: false, modelId: input.modelId };
  const bandUse = bandUseOf(input.resourceId);
  const band = bandUse ? input.preferences.useBands[bandUse] : undefined;
  // A faixa só vale na chave da empresa (D-2): na plataforma o modelo é sempre o básico do recurso.
  const bandModelId = bandUse && band ? modelForBand(bandUse, input.provider, band) : null;
  return { shouldUseCompanyKey: true, modelId: bandModelId ?? input.modelId };
}

export function decideAiFor(resource: AiResource, facts: AiKeyFacts, preferences: AiPreferences, funnel?: FunnelAiFacts): AiResourceStatus {
  const today = describeAiResource(resource, facts, funnel);
  if (today.keySource !== "platform" || !today.provider || today.provider === "other" || !today.modelId) return today;
  if (!preferences.companyKeyResources.includes(resource.id) || !SELECTOR_WIRED_RESOURCE_IDS.has(resource.id)) return today;

  const companyKey = facts.companyKeys[today.provider];
  if (!companyKey) {
    return { ...today, note: `Você ligou a sua chave aqui, mas a empresa não tem chave ${PROVIDER_LABEL[today.provider]} em Satélites: continua na da plataforma.` };
  }
  const override = pickCompanyKeyOverride({ resourceId: resource.id, provider: today.provider, modelId: today.modelId, preferences, hasCompanyKey: true });
  return { ...today, modelId: override.modelId, keySource: "company", keyLast4: companyKey.last4, payer: "company", followsRule: true, note: null };
}
