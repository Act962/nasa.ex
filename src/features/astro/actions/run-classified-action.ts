import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { proposeAction } from "./confirmation";
import { buildActionInput } from "./coerce-fields";
import type { AstroConfirmationPayload } from "@/features/astro/lib/astro-confirmation";
import type { AstroAction, AstroActionResult } from "./types";
import {
  HIGH_CONFIDENCE,
  LOW_CONFIDENCE,
  type StagedClassification,
} from "./classify-staged";

// Caminho curto do roteamento (spec 0023, RF-4): a ação escolhida pelo
// classificador executa aqui, em código, e a resposta volta no mesmo formato
// de stream que o cliente já sabe renderizar — sem passar pelo orquestrador.

export interface ClassifiedRun {
  response: Response;
  /** Camada que resolveu — vai para `metadata.route` (spec 0025, RF-8). */
  route: string;
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
 * Cartão de escolha: o Astro mostra as ações que considerou e o usuário toca
 * na certa. Não gasta token nenhum — os candidatos já vieram da etapa 2 — e
 * acerta sempre, porque quem responde é quem sabe (spec 0025, RF-4/RNF-3).
 */
function buildChoiceRun(
  classification: StagedClassification,
  userText: string,
): ClassifiedRun {
  const options = classification.candidates
    .map((candidate) => {
      const action = getAstroAction(candidate.action);
      if (!action) return null;
      return {
        id: candidate.action,
        label: action.confirmTitle ?? shortLabel(action.description),
      };
    })
    .filter((option): option is { id: string; label: string } => option !== null);

  const payload: AstroActionResult = {
    status: "ambiguous",
    title: "O que você quer fazer?",
    description: `Entendi "${userText}" de mais de um jeito. Qual deles?`,
    field: "action",
    options,
    appName: classification.app,
  };

  const toolCallId = `astro-choice-${Date.now()}`;
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "choose_action",
        input: { text: userText },
      });
      writer.write({ type: "tool-output-available", toolCallId, output: payload });
      const textId = `${toolCallId}-text`;
      writer.write({ type: "text-start", id: textId });
      writer.write({ type: "text-delta", id: textId, delta: payload.description });
      writer.write({ type: "text-end", id: textId });
    },
  });

  return {
    response: createUIMessageStreamResponse({ stream }),
    route: "dropdown",
    actionKey: classification.candidates[0]?.action ?? "—",
    tokensUsed: classification.tokensUsed,
    provider: classification.provider,
    modelId: classification.modelId,
  };
}

/** Primeira frase da descrição, que é o rótulo humano da ação. */
function shortLabel(description: string): string {
  const [first] = description.split(" — ");
  return first.split(". ")[0];
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
  const [best, ...rest] = params.classification.candidates;
  if (!best) return null;

  // Dúvida vira dropdown, não chute nem modelo mais caro (spec 0025, D-2):
  // quem sabe a resposta é o usuário, e perguntar custa zero token.
  if (best.confidence < HIGH_CONFIDENCE && rest.length > 0) {
    if (best.confidence < LOW_CONFIDENCE) return null;
    return buildChoiceRun(params.classification, params.userText ?? "");
  }

  const action = getAstroAction(best.action);
  if (!action) return null;

  // Campo obrigatório faltando não escala para o orquestrador: perguntar o que
  // falta é barato e é o que sustenta o ciclo guiado por voz (RF-11). Quem lê
  // a pergunta em voz alta é o auto-narrate, que já existe.
  // O que o verbo já diz (polaridade) entra por código; o que o modelo
  // extraiu vence, caso tenha dito algo explícito.
  const fields = buildActionInput(
    action,
    best.fields,
    params.userText ?? "",
    params.history,
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
    route: params.classification.layer,
    actionKey: action.key,
    tokensUsed: params.classification.tokensUsed,
    provider: params.classification.provider,
    modelId: params.classification.modelId,
  };
}
