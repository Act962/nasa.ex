import { MODEL_CATALOG } from "./router/model-catalog";
import type { AiProviderName, AiResource } from "./ai-resources";

// "De onde sai" de cada recurso de IA (spec 0093, RF-4): provedor, modelo, origem da chave e quem
// paga, para uma empresa. Função pura sobre fatos já carregados: não lê banco nem chave, e por isso
// pode ser conferida por script. Descreve o que o código faz hoje, sem corrigir nada.

export type AiKeySource = "company" | "funnel" | "planner" | "platform" | "free" | "none";
export type AiPayer = "company" | "platform" | "nobody";

/** O que se sabe das chaves de uma empresa. Nunca carrega a chave: só se existe e o final dela. */
export interface AiKeyFacts {
  companyKeys: Partial<Record<AiProviderName, { last4: string }>>;
  platformKeys: Record<AiProviderName, boolean>;
  hasPlannerAnthropicKey: boolean;
  /** Modelo de texto que o atendimento usa quando o funil não escolheu nenhum. */
  defaultFunnelModelId: string;
  /** Modelo de voz em tempo real em vigor. */
  realtimeVoiceModelId: string;
}

export interface FunnelAiFacts {
  trackingId: string;
  trackingName: string;
  provider: AiProviderName | null;
  modelId: string | null;
  hasOwnKey: boolean;
  keyLast4: string | null;
}

export interface AiResourceStatus {
  resourceId: string;
  trackingId: string | null;
  trackingName: string | null;
  provider: AiProviderName | "other" | null;
  modelId: string | null;
  keySource: AiKeySource;
  keyLast4: string | null;
  payer: AiPayer;
  /** Segue a regra do produto: chave da empresa primeiro, plataforma depois. */
  followsRule: boolean;
  /** Frase para a tela quando algo foge do esperado. */
  note: string | null;
}

const DEFAULT_FUNNEL_MODEL_BY_PROVIDER: Record<AiProviderName, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-sonnet-4-5",
  google: "gemini-2.5-flash",
};

const PROVIDER_LABEL: Record<AiProviderName, string> = { openai: "OpenAI", google: "Gemini", anthropic: "Anthropic" };

function payerOf(keySource: AiKeySource): AiPayer {
  if (keySource === "company" || keySource === "funnel" || keySource === "planner") return "company";
  return keySource === "platform" ? "platform" : "nobody";
}

/** Os modelos que o recurso pode usar, na ordem em que ele tenta. */
function candidateModels(resource: AiResource, facts: AiKeyFacts): { provider: AiProviderName | "other"; modelId: string }[] {
  const { model } = resource;
  if (model.kind === "tier") return MODEL_CATALOG.filter((entry) => entry.tier === model.tier).map((entry) => ({ provider: entry.provider, modelId: entry.id }));
  if (model.kind === "cascade") return model.options;
  if (model.kind === "realtime-voice") return [{ provider: "openai", modelId: facts.realtimeVoiceModelId }];
  if (model.kind === "fixed") return [{ provider: model.provider, modelId: model.modelId }];
  return [{ provider: "openai", modelId: facts.defaultFunnelModelId }];
}

export function describeAiResource(resource: AiResource, facts: AiKeyFacts, funnel?: FunnelAiFacts): AiResourceStatus {
  const base = { resourceId: resource.id, trackingId: funnel?.trackingId ?? null, trackingName: funnel?.trackingName ?? null };
  const finish = (
    picked: { provider: AiProviderName | "other" | null; modelId: string | null; keySource: AiKeySource; keyLast4?: string | null },
    extra: { followsRule: boolean; note?: string | null },
  ): AiResourceStatus => ({
    ...base,
    provider: picked.provider,
    modelId: picked.modelId,
    keySource: picked.keySource,
    keyLast4: picked.keyLast4 ?? null,
    payer: payerOf(picked.keySource),
    followsRule: extra.followsRule,
    note: extra.note ?? null,
  });

  if (resource.keyRule === "free") {
    const [freeModel] = candidateModels(resource, facts);
    return finish({ provider: "other", modelId: freeModel.modelId, keySource: "free" }, { followsRule: true });
  }

  if (resource.keyRule === "funnel-then-platform") {
    if (funnel?.hasOwnKey && funnel.provider) {
      return finish(
        { provider: funnel.provider, modelId: funnel.modelId ?? DEFAULT_FUNNEL_MODEL_BY_PROVIDER[funnel.provider], keySource: "funnel", keyLast4: funnel.keyLast4 },
        { followsRule: true },
      );
    }
    if (!facts.platformKeys.openai) return finish({ provider: null, modelId: null, keySource: "none" }, { followsRule: false, note: "Sem chave no funil e sem chave da plataforma: não roda." });
    const hasCompanyKey = Object.keys(facts.companyKeys).length > 0;
    return finish(
      { provider: "openai", modelId: facts.defaultFunnelModelId, keySource: "platform" },
      {
        followsRule: !hasCompanyKey,
        note: hasCompanyKey ? "A empresa tem chave em Satélites, mas este recurso só olha a chave do funil e depois a da plataforma." : null,
      },
    );
  }

  const candidates = candidateModels(resource, facts);
  const realProviders = candidates.filter((candidate): candidate is { provider: AiProviderName; modelId: string } => candidate.provider !== "other");

  if (resource.keyRule === "company-then-platform") {
    for (const candidate of realProviders) {
      const companyKey = facts.companyKeys[candidate.provider];
      if (companyKey) return finish({ ...candidate, keySource: "company", keyLast4: companyKey.last4 }, { followsRule: true });
      if (facts.platformKeys[candidate.provider]) return finish({ ...candidate, keySource: "platform" }, { followsRule: true });
    }
    return finish({ provider: null, modelId: null, keySource: "none" }, { followsRule: true, note: "Nenhuma chave disponível: não roda." });
  }

  if (resource.keyRule === "company-only") {
    for (const candidate of realProviders) {
      const companyKey = facts.companyKeys[candidate.provider];
      if (companyKey) return finish({ ...candidate, keySource: "company", keyLast4: companyKey.last4 }, { followsRule: true });
    }
    if (resource.freeFallbackModelId) {
      return finish(
        { provider: "other", modelId: resource.freeFallbackModelId, keySource: "free" },
        { followsRule: true, note: `Sem chave ${PROVIDER_LABEL[realProviders[0].provider]} da empresa, usa o serviço gratuito, de qualidade menor.` },
      );
    }
    const needed = [...new Set(realProviders.map((candidate) => PROVIDER_LABEL[candidate.provider]))].join(" ou ");
    return finish(
      { provider: realProviders[0]?.provider ?? null, modelId: realProviders[0]?.modelId ?? null, keySource: "none" },
      { followsRule: false, note: `Só roda com chave da empresa (${needed}) em Satélites. Sem chave, não usa nem a da plataforma.` },
    );
  }

  if (resource.keyRule === "platform-only") {
    // Provedor que o seletor não conhece (fal.ai, Ideogram…): a chave é sempre a da plataforma.
    if (realProviders.length === 0) return finish({ provider: "other", modelId: candidates[0]?.modelId ?? null, keySource: "platform" }, { followsRule: true });
    const available = realProviders.find((candidate) => facts.platformKeys[candidate.provider]);
    if (!available) return finish({ provider: realProviders[0].provider, modelId: realProviders[0].modelId, keySource: "none" }, { followsRule: false, note: "A plataforma está sem chave deste provedor: não roda." });
    const companyKey = facts.companyKeys[available.provider];
    return finish(
      { ...available, keySource: "platform" },
      {
        followsRule: !companyKey,
        note: companyKey ? `A empresa tem chave ${PROVIDER_LABEL[available.provider]} em Satélites, mas este recurso ainda usa só a da plataforma.` : null,
      },
    );
  }

  // platform-then-company: ordem invertida.
  const [first] = realProviders;
  if (!first) return finish({ provider: null, modelId: null, keySource: "none" }, { followsRule: false });
  const companyKey = facts.companyKeys[first.provider];
  if (facts.platformKeys[first.provider]) {
    return finish(
      { ...first, keySource: "platform" },
      { followsRule: !companyKey, note: companyKey ? `A empresa tem chave ${PROVIDER_LABEL[first.provider]} em Satélites, mas aqui a da plataforma é usada antes.` : null },
    );
  }
  if (companyKey) return finish({ ...first, keySource: "company", keyLast4: companyKey.last4 }, { followsRule: true });
  if (first.provider === "anthropic" && facts.hasPlannerAnthropicKey) return finish({ ...first, keySource: "planner" }, { followsRule: true });
  return finish({ ...first, keySource: "none" }, { followsRule: false, note: "Nenhuma chave disponível: não roda." });
}
