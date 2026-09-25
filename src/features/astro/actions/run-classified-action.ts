import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import type { AstroActionResult } from "./types";
import {
  isConfirmation,
  resolveClassifiedAction,
  type ClassifiedOutput,
} from "./resolve-action";
import type { StagedClassification } from "./classify-staged";

// Caminho curto do roteamento (spec 0023, RF-4): a ação escolhida pelo
// classificador executa em código, e a resposta volta no mesmo formato de
// stream que o cliente já sabe renderizar — sem passar pelo orquestrador.
//
// A DECISÃO mora em `resolve-action.ts`, compartilhada com o WhatsApp. Aqui
// só há o embrulho em stream.

export interface ClassifiedRun {
  response: Response;
  /** Camada que resolveu — vai para `metadata.route` (spec 0025, RF-8). */
  route: string;
  actionKey: string;
  tokensUsed: number;
  provider: string;
  modelId: string;
}

function textFor(result: ClassifiedOutput): string {
  // Confirmação pendente: o cartão já pergunta, o texto não repete a pergunta.
  if (isConfirmation(result)) return result.title;
  if (result.status === "done") {
    // RF-13: a URL não é lida nem repetida — ela vive no cartão. Só página
    // pública é "link para o cliente"; criar um funil não gera link nenhum.
    return result.publicUrl
      ? `${result.description}\n\nO link para enviar ao cliente está no cartão acima.`
      : result.description;
  }
  return result.description;
}

function streamed(params: {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  text: string;
}): Response {
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Emitido como tool part porque é assim que o cliente já reconhece
      // payload estruturado e monta o cartão (`astro-message.tsx`).
      writer.write({
        type: "tool-input-available",
        toolCallId: params.toolCallId,
        toolName: params.toolName,
        input: params.input,
      });
      writer.write({
        type: "tool-output-available",
        toolCallId: params.toolCallId,
        output: params.output,
      });
      const textId = `${params.toolCallId}-text`;
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: params.text });
      writer.write({ type: "text-end", id: textId });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

/**
 * Executa a ação classificada e devolve a resposta em stream. `null` significa
 * "não consigo resolver por aqui" — quem chama segue para o orquestrador.
 */
export async function runClassifiedAction(params: {
  ctx: AgentContext;
  classification: StagedClassification;
  /** Frase original — `inferFields` lê dela a polaridade do verbo. */
  userText?: string;
  /** Turnos anteriores — só eles autorizam um nome que a frase não disse. */
  history?: string[];
}): Promise<ClassifiedRun | null> {
  const resolved = await resolveClassifiedAction(params);
  if (!resolved) return null;

  const common = {
    tokensUsed: params.classification.tokensUsed,
    provider: params.classification.provider,
    modelId: params.classification.modelId,
  };

  if (resolved.kind === "choice") {
    const payload: AstroActionResult = resolved.payload;
    return {
      response: streamed({
        toolCallId: `astro-choice-${Date.now()}`,
        toolName: "choose_action",
        input: { text: params.userText ?? "" },
        output: payload,
        text: payload.description,
      }),
      route: "dropdown",
      actionKey: resolved.actionKey,
      ...common,
    };
  }

  return {
    response: streamed({
      toolCallId: `astro-action-${Date.now()}`,
      toolName: resolved.action.toolName,
      input: {},
      output: resolved.output,
      text: textFor(resolved.output),
    }),
    route: resolved.denied ? "denied" : params.classification.layer,
    actionKey: resolved.action.key,
    ...common,
  };
}
