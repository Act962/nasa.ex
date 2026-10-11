import "server-only";
import type { LanguageModel } from "ai";
import prisma from "@/lib/prisma";
import { EMPTY_AI_PREFERENCES, parseAiPreferences, type AiPreferences } from "@/features/ia/lib/ai-preferences";
import { pickCompanyKeyOverride } from "@/features/ia/lib/decide-ai-for";
import { buildLanguageModel, envKeyFor, loadOrganizationKeys, type AiProviderId, type KeySource } from "@/features/ia/lib/router/providers";

// Seletor único de chave e modelo (spec 0093, etapa 2, RF-17). O ponto de chamada informa o provedor
// e o modelo que sempre usou; o seletor só troca pela chave da empresa (e pela faixa escolhida) quando
// o dono ou admin ligou aquele recurso nas preferências. Qualquer falha ao ler preferências ou chaves
// volta ao comportamento de sempre: a automação de um cliente não pode parar por causa de uma escolha.

export interface ResolvedAi {
  model: LanguageModel;
  provider: AiProviderId;
  modelId: string;
  /** `organization` = chave da empresa (ela paga o provedor); `env` = chave da plataforma. */
  keySource: KeySource;
}

export class MissingPlatformAiKeyError extends Error {
  constructor(provider: AiProviderId) {
    super(`Chave de ${provider} da plataforma ausente no servidor.`);
    this.name = "MissingPlatformAiKeyError";
  }
}

/** Preferências de IA da empresa. Coluna ausente ou valor inválido viram o padrão vazio. */
export async function loadAiPreferences(organizationId: string): Promise<AiPreferences> {
  try {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { aiPreferences: true } });
    return parseAiPreferences(organization?.aiPreferences);
  } catch (readError) {
    console.warn("[ia/preferences] não foi possível ler as preferências de IA; valendo o padrão.", readError instanceof Error ? readError.message : readError);
    return EMPTY_AI_PREFERENCES;
  }
}

async function findCompanyOverride(input: { resourceId: string; organizationId: string; provider: AiProviderId; modelId: string }) {
  if (!input.organizationId) return null;
  const preferences = await loadAiPreferences(input.organizationId);
  if (!preferences.companyKeyResources.includes(input.resourceId)) return null;
  const companyKey = (await loadOrganizationKeys(input.organizationId))[input.provider];
  const override = pickCompanyKeyOverride({ resourceId: input.resourceId, provider: input.provider, modelId: input.modelId, preferences, hasCompanyKey: Boolean(companyKey) });
  return companyKey && override.shouldUseCompanyKey ? { apiKey: companyKey.apiKey, modelId: override.modelId } : null;
}

export async function resolveAiFor(input: { resourceId: string; organizationId: string; provider: AiProviderId; modelId: string }): Promise<ResolvedAi> {
  try {
    const companyOverride = await findCompanyOverride(input);
    if (companyOverride) {
      return { model: buildLanguageModel(input.provider, companyOverride.apiKey, companyOverride.modelId), provider: input.provider, modelId: companyOverride.modelId, keySource: "organization" };
    }
  } catch (overrideError) {
    console.warn(`[ia/resolve] falha ao aplicar a chave da empresa em "${input.resourceId}"; usando a da plataforma.`, overrideError instanceof Error ? overrideError.message : overrideError);
  }
  const platformKey = envKeyFor(input.provider);
  if (!platformKey) throw new MissingPlatformAiKeyError(input.provider);
  return { model: buildLanguageModel(input.provider, platformKey, input.modelId), provider: input.provider, modelId: input.modelId, keySource: "env" };
}
