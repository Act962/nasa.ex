import "server-only";

import type { LanguageModel } from "ai";

import {
  MODEL_CATALOG,
  modelsForTier,
  satisfies,
  type AstroTier,
  type CapabilityRequirements,
  type CatalogModel,
} from "./model-catalog";
import {
  buildLanguageModel,
  envKeyFor,
  loadOrganizationKeys,
  type AiProviderId,
  type KeySource,
} from "./providers";
import { isProviderExhausted } from "@/features/ai-credits/lib/provider-exhaustion";

export interface ResolvedModel {
  model: LanguageModel;
  provider: AiProviderId;
  modelId: string;
  tier: AstroTier;
  /** `organization` significa chave do cliente: o custo para nós é zero. */
  keySource: KeySource;
}

export interface ResolveModelOptions {
  organizationId: string;
  tier: AstroTier;
  /** Capacidades que a tarefa exige. Modelo que não atende é descartado. */
  requires?: CapabilityRequirements;
  /** Empurra um provedor para o topo, sem excluir os outros. */
  preferProvider?: AiProviderId;
  /** Força um id de modelo específico no primeiro candidato (override de env). */
  forceModelId?: string;
  /** IAs ligadas pelo usuário, em ordem de prioridade (spec 0055, RF-15). Vazio/ausente = todas, na ordem do catálogo. */
  providerOrder?: AiProviderId[];
  /** Modelos desligados pelo usuário (spec 0055, RF-16): o roteador usa outro ligado da mesma IA. */
  disabledModelIds?: string[];
}

/** Nenhum provedor com chave disponível para o que a tarefa pede. */
export class NoAiProviderError extends Error {
  constructor(readonly tier: AstroTier) {
    super(
      "Nenhuma chave de IA disponível. Cadastre uma em Satélites (OpenAI, Gemini ou Anthropic) " +
        "ou configure a chave da plataforma.",
    );
    this.name = "NoAiProviderError";
  }
}

/**
 * Devolve os modelos a tentar, em ordem: o primeiro é o principal, os demais são
 * fallback de disponibilidade.
 *
 * A ordem sai de três coisas, nesta sequência:
 *   1. capacidade — visão, ferramentas, contexto longo;
 *   2. preferência declarada no catálogo, que é deliberada;
 *   3. chave disponível — a da organização antes da nossa.
 *
 * **Não ordena por preço.** Modelo barato que não chama ferramenta não resolve
 * a tarefa mais barato — não resolve. E a tabela de custo ainda não foi
 * conferida com os provedores, então deixá-la escolher trocaria o modelo de
 * todo mundo com base em número não confiável.
 */
export async function resolveModels(
  options: ResolveModelOptions,
): Promise<ResolvedModel[]> {
  const organizationKeys = await loadOrganizationKeys(options.organizationId);
  const withExhaustionSkipped = buildCandidateModels(options, organizationKeys, true);
  if (withExhaustionSkipped.length > 0) return withExhaustionSkipped;
  // Todos os provedores marcados sem crédito: melhor tentar de novo do que não responder (spec 0055, CB-4).
  const withExhausted = buildCandidateModels(options, organizationKeys, false);
  if (withExhausted.length > 0) return withExhausted;
  const hasUserChoices = Boolean(options.providerOrder?.length || options.disabledModelIds?.length);
  if (!hasUserChoices) return [];
  // Nada do que o usuário ligou responde (ou desligou tudo): vale a inteligência da plataforma, sem as chaves dele.
  const platformOnly = buildCandidateModels(
    { ...options, providerOrder: undefined, disabledModelIds: undefined, preferProvider: undefined, forceModelId: undefined },
    {},
    false,
  );
  if (platformOnly.length > 0) return platformOnly;
  return buildCandidateModels({ ...options, providerOrder: undefined, disabledModelIds: undefined }, organizationKeys, false);
}

function forcedModelFitsProvider(forcedModelId: string, provider: AiProviderId): boolean {
  if (/^(gpt|o\d)/.test(forcedModelId)) return provider === "openai";
  if (forcedModelId.startsWith("gemini")) return provider === "google";
  if (forcedModelId.startsWith("claude")) return provider === "anthropic";
  return true;
}

function findEnabledSubstitute(
  disabledCandidate: CatalogModel,
  disabledModelIds: Set<string>,
  options: ResolveModelOptions,
): CatalogModel | null {
  const enabledSameProvider = MODEL_CATALOG.filter(
    (model) =>
      model.provider === disabledCandidate.provider &&
      !disabledModelIds.has(model.id) &&
      satisfies(model, options.requires),
  );
  return enabledSameProvider.find((model) => model.tier === disabledCandidate.tier) ?? enabledSameProvider[0] ?? null;
}

function buildCandidateModels(
  options: ResolveModelOptions,
  organizationKeys: Awaited<ReturnType<typeof loadOrganizationKeys>>,
  shouldSkipExhausted: boolean,
): ResolvedModel[] {
  // A ordem base é a declarada no catálogo, que é a preferência deliberada.
  // `preferProvider` apenas puxa um provedor para a frente sem reordenar o
  // resto — é o único critério que altera a ordem.
  const providerOrder = options.providerOrder?.length ? options.providerOrder : null;
  const providerRank = (provider: AiProviderId) => (providerOrder ? providerOrder.indexOf(provider) : 0);
  const candidates = modelsForTier(options.tier)
    .filter((model) => satisfies(model, options.requires))
    .filter((model) => !providerOrder || providerOrder.includes(model.provider))
    .sort((left, right) => providerRank(left.provider) - providerRank(right.provider))
    .sort((left, right) => {
      if (!options.preferProvider) return 0;
      const leftPreferred = left.provider === options.preferProvider ? 0 : 1;
      const rightPreferred = right.provider === options.preferProvider ? 0 : 1;
      return leftPreferred - rightPreferred;
    });

  const resolved: ResolvedModel[] = [];
  const seenProviders = new Set<AiProviderId>();
  const disabledModelIds = new Set(options.disabledModelIds ?? []);

  for (const tierCandidate of candidates) {
    // Modelo desligado: outro ligado da mesma IA (mesmo nível primeiro); sem nenhum ligado, a IA fica de fora.
    const candidate = disabledModelIds.has(tierCandidate.id)
      ? findEnabledSubstitute(tierCandidate, disabledModelIds, options)
      : tierCandidate;
    if (!candidate) continue;
    // Um candidato por provedor: o segundo modelo do mesmo provedor não é
    // fallback de verdade, porque cai se o provedor cair.
    if (seenProviders.has(candidate.provider)) continue;

    // Provedor que recusou por crédito há pouco é pulado: chave própria esgotada cai na da plataforma (spec 0055, RF-7).
    const isOrganizationKeyExhausted =
      shouldSkipExhausted && isProviderExhausted({ organizationId: options.organizationId, provider: candidate.provider });
    const isPlatformKeyExhausted =
      shouldSkipExhausted && isProviderExhausted({ organizationId: null, provider: candidate.provider });
    const organizationKey = isOrganizationKeyExhausted ? undefined : organizationKeys[candidate.provider];
    const platformKey = isPlatformKeyExhausted ? null : envKeyFor(candidate.provider);
    const apiKey = organizationKey?.apiKey ?? platformKey;
    if (!apiKey) continue;

    const isPrimary = resolved.length === 0;
    // Modelo forçado de outro provedor quebraria a chamada quando a troca automática muda o provedor.
    const shouldForceModel =
      Boolean(options.forceModelId) &&
      isPrimary &&
      !disabledModelIds.has(options.forceModelId!) &&
      forcedModelFitsProvider(options.forceModelId!, candidate.provider);
    const modelId = shouldForceModel ? options.forceModelId! : candidate.id;

    resolved.push({
      model: buildLanguageModel(candidate.provider, apiKey, modelId),
      provider: candidate.provider,
      modelId,
      tier: options.tier,
      keySource: organizationKey ? "organization" : "env",
    });
    seenProviders.add(candidate.provider);
  }

  return resolved;
}

/** Igual a `resolveModels`, mas lança quando não há nenhum candidato. */
export async function resolvePrimaryModel(
  options: ResolveModelOptions,
): Promise<ResolvedModel> {
  const resolved = await resolveModels(options);
  if (resolved.length === 0) throw new NoAiProviderError(options.tier);
  return resolved[0];
}
