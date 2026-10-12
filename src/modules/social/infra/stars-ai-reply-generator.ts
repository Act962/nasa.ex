import { resolveAiFor } from "@/features/ia/server/resolve-ai-for";
import { recordAiUsage } from "@/features/ia/server/record-ai-usage";
import "server-only";
import { generateText } from "ai";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import type {
  AiReplyGenerator,
  AiReplyRequest,
  AiReplyResult,
} from "../ports/ai-reply-generator";

/** Ação catalogada — o preço vive no catálogo único de Stars (spec 0020). */
export const SOCIAL_AI_REPLY_ACTION = "comments_ai_reply";

/**
 * Resposta por IA com cobrança em Stars.
 *
 * A cobrança vem ANTES da chamada ao modelo: cobrar depois deixaria a porta
 * aberta para gerar sem saldo quando o provider demora e o processo morre no
 * meio.
 */
export class StarsAiReplyGenerator implements AiReplyGenerator {
  async generate(request: AiReplyRequest): Promise<AiReplyResult> {
    const charge = await chargeStarsByAction(
      request.organizationId,
      SOCIAL_AI_REPLY_ACTION,
      {
        appSlug: "comments",
        description: "Resposta automática por IA no Instagram",
      },
    );

    if (!charge.success) {
      return { ok: false, reason: "NO_BALANCE" };
    }

    try {
      const resolvedAi = await resolveAiFor({ resourceId: "comments.reply", organizationId: request.organizationId, provider: "openai", modelId: "gpt-4o-mini" });
      const result = await generateText({
        model: resolvedAi.model,
        prompt: [
          `Instruções: ${request.prompt}`,
          `Mensagem do usuário: "${request.incomingText}"`,
          "Responda em português do Brasil, em até 2 frases, sem repetir a pergunta.",
        ].join("\n"),
      });

      await recordAiUsage({
        resourceId: "comments.reply",
        organizationId: request.organizationId,
        provider: "openai",
        modelId: resolvedAi.modelId,
        keySource: resolvedAi.keySource,
        usage: result.usage,
        starsCharged: charge.cost,
      });

      const text = result.text?.trim();
      if (!text) return { ok: false, reason: "EMPTY_OUTPUT" };
      return { ok: true, text };
    } catch (error) {
      return {
        ok: false,
        reason: "PROVIDER_ERROR",
        detail: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
