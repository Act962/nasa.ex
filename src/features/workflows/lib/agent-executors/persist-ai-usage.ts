/**
 * Persistência de telemetria de tokens dos nós de IA do Modo Agente IA.
 * Cria uma linha em `AiChatRun` por chamada de LLM dos executors em
 * `agent-executors/ai.ts` (AI_DECISION, AI_GENERATE_TEXT, AI_VISION,
 * READ_PDF).
 *
 * Espelha o que `tracking-chat-ai/lib/agent.ts:145-166` faz pro Chatbot
 * IA — tabela compartilhada garante que a aba "Uso" em Tracking →
 * Configurações → Chatbot IA mostre TODA fonte de consumo (chat + work-
 * flows) sem precisar mudar a UI.
 *
 * Best-effort: erros são logados mas NUNCA derrubam o executor — token
 * tracking é observabilidade, não fluxo crítico.
 */
import "server-only";
import prisma from "@/lib/prisma";

export interface PersistAiUsageArgs {
  /** Organização dona da chamada — vem do data.organizationId do nó. */
  organizationId: string;
  /** Tracking onde o workflow roda. */
  trackingId: string;
  /** Lead atual no contexto (pode ser null em workflows org-wide). */
  leadId?: string | null;
  /** Conversa do lead, se disponível. */
  conversationId?: string | null;
  /** Modelo usado (ex: "gpt-4o-mini"). */
  modelId: string;
  /**
   * Provider — null = NASA default (mesma convenção do agent.ts). Quando
   * for "OPENAI"/"ANTHROPIC"/"GOOGLE" significa BYO custom key.
   */
  provider?: "OPENAI" | "ANTHROPIC" | "GOOGLE" | null;
  usingCustom?: boolean;
  /** result.usage do `generateText` do AI SDK. */
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  } | null | undefined;
  /** Quantidade de tool calls feitas (se aplicável). Default 0. */
  toolCalls?: number;
}

export async function persistAiChatRunFromUsage(
  args: PersistAiUsageArgs,
): Promise<void> {
  if (!args.trackingId) {
    // Sem trackingId não dá pra escrever (FK). Workflows org-wide sem lead
    // não geram telemetria — aceitável por enquanto.
    return;
  }
  try {
    const inputTokens = args.usage?.inputTokens ?? 0;
    const outputTokens = args.usage?.outputTokens ?? 0;
    const totalTokens =
      args.usage?.totalTokens ?? inputTokens + outputTokens;
    await prisma.aiChatRun.create({
      data: {
        trackingId: args.trackingId,
        organizationId: args.organizationId,
        leadId: args.leadId ?? null,
        conversationId: args.conversationId ?? null,
        provider: args.provider ?? null,
        modelId: args.modelId,
        usingCustom: args.usingCustom ?? false,
        inputTokens,
        outputTokens,
        totalTokens,
        toolCalls: args.toolCalls ?? 0,
      },
    });
  } catch (err) {
    console.error("[workflow-ai persist-usage] falhou", err);
  }
}

/**
 * Extrai os campos comuns do contexto do workflow.
 * Espelha o que os executors já fazem inline pra cobrança de Stars.
 */
export function extractAiContextFields(
  context: Record<string, unknown>,
  data: Record<string, unknown>,
): {
  organizationId: string;
  trackingId: string;
  leadId: string | null;
  conversationId: string | null;
} {
  const lead = (context.lead as Record<string, unknown> | undefined) ?? {};
  const trigger =
    (context.trigger as Record<string, unknown> | undefined) ?? {};

  const organizationId = String(
    data.organizationId ?? trigger.organizationId ?? "",
  );
  const trackingId = String(lead.trackingId ?? trigger.trackingId ?? "");
  const leadId = lead.id ? String(lead.id) : null;
  const conversationId = lead.conversationId
    ? String(lead.conversationId)
    : null;

  return { organizationId, trackingId, leadId, conversationId };
}
