import "server-only";
import type { UsageEventKind } from "@/generated/prisma/client";
import { AI_RESOURCE_BY_ID, type AiResourceKind } from "@/features/ia/lib/ai-resources";
import { recordUsageEvent } from "@/features/stars/lib/metering/record-usage-event";

// Registro único do uso de IA (spec 0093, RF-5): uma linha em `usage_event` por chamada, com o recurso
// do cadastro, o modelo e de qual chave saiu. Só registra: não debita Stars. Quem já cobra informa
// quantas Stars cobrou, para o consumo bater. Nunca lança e nunca roda dentro de transação (regra 18).

export type AiUsageKeySource = "organization" | "tracking" | "planner" | "platform" | "free";

/** Formato de uso do AI SDK (v4 e v5) e dos SDKs dos provedores. */
export interface AiTokenUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
}

const KIND_BY_RESOURCE_KIND: Record<AiResourceKind, UsageEventKind> = {
  text: "LLM",
  voice: "REALTIME",
  transcription: "TRANSCRIPTION",
  speech: "OTHER",
  image: "IMAGE",
  video: "VIDEO",
};

export interface RecordAiUsageInput {
  resourceId: string;
  organizationId: string;
  userId?: string | null;
  provider?: string;
  modelId?: string;
  /** `env` é como o seletor central chama a chave da plataforma. */
  keySource: AiUsageKeySource | "env";
  usage?: AiTokenUsage | null;
  quantity?: number;
  quantityUnit?: string;
  /** Um dos `usageFeatures` do recurso, quando ele tem mais de um. */
  feature?: string;
  /** Stars que o próprio ponto de chamada já cobrou por este uso. */
  starsCharged?: number;
  trackingId?: string | null;
  leadId?: string | null;
  status?: "ok" | "provider_error";
}

export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  const resource = AI_RESOURCE_BY_ID.get(input.resourceId);
  if (!resource) {
    console.warn(`[ia] uso de IA sem recurso no cadastro: "${input.resourceId}".`);
    return;
  }
  const keySource: AiUsageKeySource = input.keySource === "env" ? "platform" : input.keySource;
  const inputTokens = input.usage?.inputTokens ?? input.usage?.promptTokens ?? input.usage?.input_tokens ?? undefined;
  const outputTokens = input.usage?.outputTokens ?? input.usage?.completionTokens ?? input.usage?.output_tokens ?? undefined;
  const hasTokens = inputTokens !== undefined || outputTokens !== undefined;

  await recordUsageEvent({
    organizationId: input.organizationId,
    userId: input.userId ?? undefined,
    kind: KIND_BY_RESOURCE_KIND[resource.kind],
    action: resource.usageActions[0],
    appSlug: resource.id.split(".")[0],
    feature: input.feature ?? resource.usageFeatures[0],
    provider: input.provider,
    modelId: input.modelId,
    usingCustomKey: keySource === "organization" || keySource === "tracking" || keySource === "planner",
    tokens: hasTokens ? { inputTokens, outputTokens, totalTokens: input.usage?.totalTokens ?? (inputTokens ?? 0) + (outputTokens ?? 0) } : undefined,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    // Serviço gratuito não custa nada ao provedor; sem isso viraria "sem preço".
    providerCostUsd: keySource === "free" ? 0 : undefined,
    starsCharged: input.starsCharged ?? 0,
    trackingId: input.trackingId ?? undefined,
    leadId: input.leadId ?? undefined,
    status: input.status ?? "ok",
    metadata: { keySource, resourceId: resource.id },
  });
}
