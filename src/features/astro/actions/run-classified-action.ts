import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { proposeAction } from "./confirmation";
import type { AstroConfirmationPayload } from "@/features/astro/lib/astro-confirmation";
import type { AstroAction, AstroActionResult } from "./types";
import type { AstroIntentClassification } from "./classify-intent";

// Caminho curto do roteamento (spec 0023, RF-4): a ação escolhida pelo
// classificador executa aqui, em código, e a resposta volta no mesmo formato
// de stream que o cliente já sabe renderizar — sem passar pelo orquestrador.

export interface ClassifiedRun {
  response: Response;
  /** Vai para `metadata.route` do UsageEvent (RNF-4). */
  route: "classifier";
  actionKey: string;
  tokensUsed: number;
  provider: string;
  modelId: string;
}

function missingRequiredFields(
  action: AstroAction,
  fields: Record<string, string>,
): string[] {
  const parsed = action.input.safeParse(fields);
  if (parsed.success) return [];
  return parsed.error.issues
    .filter((issue) => issue.code === "invalid_type" || issue.code === "too_small")
    .map((issue) => String(issue.path[0] ?? ""))
    .filter(Boolean);
}

/** Rótulo falado do campo. Sem isso o Astro pediria "clientName" em voz alta. */
const FIELD_LABELS: Record<string, string> = {
  clientName: "o nome do cliente",
  productName: "o produto",
  title: "o título",
  validUntil: "a validade",
};

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

type ClassifiedOutput = AstroActionResult | AstroConfirmationPayload;

function isConfirmation(value: ClassifiedOutput): value is AstroConfirmationPayload {
  return "kind" in value && value.kind === "astro_confirmation";
}

function textFor(result: ClassifiedOutput): string {
  // Confirmação pendente: o cartão já pergunta, o texto não repete a pergunta.
  if (isConfirmation(result)) return result.title;
  if (result.status === "done") {
    // RF-13: a URL não é lida nem repetida — ela vive no cartão.
    return `${result.description}\n\nO link para enviar ao cliente está no cartão acima.`;
  }
  return result.description;
}

/**
 * Executa a ação classificada e devolve a resposta em stream. `null` significa
 * "não consigo resolver por aqui" — quem chama segue para o orquestrador.
 */
export async function runClassifiedAction(params: {
  ctx: AgentContext;
  classification: AstroIntentClassification;
}): Promise<ClassifiedRun | null> {
  const action = getAstroAction(params.classification.action ?? "");
  if (!action) return null;

  // Campo obrigatório faltando não escala para o orquestrador: perguntar o que
  // falta é barato e é o que sustenta o ciclo guiado por voz (RF-11). Quem lê
  // a pergunta em voz alta é o auto-narrate, que já existe.
  const missing = missingRequiredFields(action, params.classification.fields);
  const parsed = action.input.safeParse(params.classification.fields);

  const result: ClassifiedOutput =
    missing.length > 0 || !parsed.success
      ? {
          status: "needs_input",
          title: "Falta uma informação",
          description: `Para continuar, me diga: ${missing.map(labelFor).join(", ")}.`,
          missingFields: missing.map((field) => ({ key: field, label: labelFor(field) })),
          appName: "Órbita",
        }
      : action.requiresConfirmation
        ? await proposeAction({
            ctx: params.ctx,
            action,
            input: parsed.data as Record<string, unknown>,
            warnings: action.confirmWarnings,
          })
        : await action.execute({ ctx: params.ctx, input: parsed.data });

  const toolCallId = `astro-action-${Date.now()}`;
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // Emitido como tool part porque é assim que o cliente já reconhece
      // payload estruturado e monta o cartão (`astro-message.tsx`).
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: action.toolName,
        input: parsed.success ? parsed.data : params.classification.fields,
      });
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: result,
      });

      const textId = `${toolCallId}-text`;
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: textFor(result) });
      writer.write({ type: "text-end", id: textId });
    },
  });

  return {
    response: createUIMessageStreamResponse({ stream }),
    route: "classifier",
    actionKey: action.key,
    tokensUsed: params.classification.tokensUsed,
    provider: params.classification.provider,
    modelId: params.classification.modelId,
  };
}
