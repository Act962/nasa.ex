import "server-only";

import type { LanguageModel } from "ai";

import {
  modelsForTier,
  satisfies,
  type AstroTier,
  type CapabilityRequirements,
} from "./model-catalog";
import {
  buildLanguageModel,
  envKeyFor,
  loadOrganizationKeys,
  type AiProviderId,
  type KeySource,
} from "./providers";

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
}

/** Nenhum provedor com chave disponível para o que a tarefa pede. */
export class NoAiProviderError extends Error {
  constructor(readonly tier: AstroTier) {
    super(
      "Nenhuma chave de IA disponível. Cadastre uma em Integrações (OpenAI, Gemini ou Anthropic) " +
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

  // A ordem base é a declarada no catálogo, que é a preferência deliberada.
  // `preferProvider` apenas puxa um provedor para a frente sem reordenar o
  // resto — é o único critério que altera a ordem.
  const candidates = modelsForTier(options.tier)
    .filter((model) => satisfies(model, options.requires))
    .sort((left, right) => {
      if (!options.preferProvider) return 0;
      const leftPreferred = left.provider === options.preferProvider ? 0 : 1;
      const rightPreferred = right.provider === options.preferProvider ? 0 : 1;
      return leftPreferred - rightPreferred;
    });

  const resolved: ResolvedModel[] = [];
  const seenProviders = new Set<AiProviderId>();

  for (const candidate of candidates) {
    // Um candidato por provedor: o segundo modelo do mesmo provedor não é
    // fallback de verdade, porque cai se o provedor cair.
    if (seenProviders.has(candidate.provider)) continue;

    const organizationKey = organizationKeys[candidate.provider];
    const apiKey = organizationKey?.apiKey ?? envKeyFor(candidate.provider);
    if (!apiKey) continue;

    const isPrimary = resolved.length === 0;
    const modelId =
      options.forceModelId && isPrimary ? options.forceModelId : candidate.id;

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
