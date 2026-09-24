import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { proposeAction } from "./confirmation";
import { buildActionInput } from "./coerce-fields";
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
  fields: Record<string, unknown>,
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
  leadName: "o nome do lead",
  personName: "o nome da pessoa",
  formName: "o nome do formulário",
  trackingName: "o nome do tracking",
  agendaName: "o nome da agenda",
  statusName: "o nome da coluna",
  currentName: "o nome atual da coluna",
  newName: "o novo nome",
  startsAt: "o novo horário",
  remindTime: "o horário",
  recurrence: "a frequência",
  message: "a mensagem",
  note: "o que anotar",
  date: "o dia",
  phone: "o telefone",
  templateName: "o nome do template",
  published: "se é para publicar ou tirar do ar",
  favorite: "se é para favoritar ou desfavoritar",
  active: "se é para ativar ou desativar",
  blocked: "se é para bloquear ou liberar",
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
  /** Frase original — `inferFields` lê dela a polaridade do verbo. */
  userText?: string;
}): Promise<ClassifiedRun | null> {
  const action = getAstroAction(params.classification.action ?? "");
  if (!action) return null;

  // Campo obrigatório faltando não escala para o orquestrador: perguntar o que
  // falta é barato e é o que sustenta o ciclo guiado por voz (RF-11). Quem lê
  // a pergunta em voz alta é o auto-narrate, que já existe.
  // O que o verbo já diz (polaridade) entra por código; o que o modelo
  // extraiu vence, caso tenha dito algo explícito.
  const fields = buildActionInput(
    action,
    params.classification.fields,
    params.userText ?? "",
  );
  const missing = missingRequiredFields(action, fields);
  const parsed = action.input.safeParse(fields);

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
        input: parsed.success ? parsed.data : fields,
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
