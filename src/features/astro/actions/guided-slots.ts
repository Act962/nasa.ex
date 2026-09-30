import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { classifyStaged } from "./classify-staged";
import { matchIntentPattern, matchesAnyIntentPattern } from "./match-intent-pattern";
import { isAccountingQuestion } from "@/features/astro/queries/accounting-question";
import {
  resolveActionWithFields,
  resolveClassifiedAction,
  type ResolvedClassification,
} from "./resolve-action";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";
import {
  answerToValue,
  isAbandonPhrase,
  looksLikeNewRequest,
  toStringFields,
} from "./guided-answers";
import { clearPlanSlot, continuePlan, readPlanSlot, startPlan } from "./plan/plan-flow";

/**
 * Memória do ciclo guiado.
 *
 * Cada resposta do usuário era reclassificada do zero, então o que ele já
 * tinha dito se perdia: o lançamento pedia a conta, depois o tipo, depois o
 * valor — e voltava a pedir o valor, em loop. Aqui o que foi coletado fica
 * guardado por sessão e a próxima resposta SOMA, em vez de recomeçar.
 *
 * O estado vive em memória, por processo, com validade curta. É deliberado
 * por ora: persistir exigiria migração, e perder o ciclo num restart custa
 * ao usuário repetir a frase — não custa dado errado. Registrado como
 * limitação para virar tabela quando o fluxo se provar.
 */

const SLOT_TTL_MS = 15 * 60_000;

interface GuidedSlot {
  actionKey: string;
  fields: Record<string, string>;
  awaitingField?: string;
  options?: { id: string; label: string }[];
  /** A pergunta tinha seletor — a resposta veio do cartão, não de texto livre. */
  hadPicker?: boolean;
  expiresAt: number;
}

const globalForSlots = globalThis as unknown as {
  astroGuidedSlots?: Map<string, GuidedSlot>;
};
const slots = (globalForSlots.astroGuidedSlots ??= new Map<string, GuidedSlot>());

function readSlot(sessionId: string): GuidedSlot | null {
  const slot = slots.get(sessionId);
  if (!slot) return null;
  if (slot.expiresAt < Date.now()) {
    slots.delete(sessionId);
    return null;
  }
  return slot;
}

/**
 * A camada de leitura deve ficar de fora desta mensagem?
 *
 * Só quando há pergunta no ar E a mensagem responde a ela. Checar apenas a
 * pergunta pendente tapava a consulta: "me envie a lista das contas" ficava
 * sem resposta porque a leitura estava desligada enquanto o Astro esperava
 * o nome de uma conta.
 */
/** Há pergunta do ciclo guiado esperando resposta? */
export function isAwaitingAnswer(sessionId: string): boolean {
  return readSlot(sessionId) !== null || readPlanSlot(sessionId) !== null;
}

export function shouldSkipReading(sessionId: string, text: string): boolean {
  const slot = readSlot(sessionId) ?? readPlanSlot(sessionId);
  if (!slot) return false;
  // Escolha feita no seletor (com id) é resposta, nunca pedido novo:
  // "Reunião QA de hoje", escolhida para cancelar, virava "o que tenho hoje".
  // Texto livre segue a regra de sempre — no WhatsApp e na voz o campo não
  // trava, e "quantos leads eu tenho?" no meio de uma proposta é assunto novo.
  if (parsePickedAnswer(text).id) return true;
  return !looksLikeNewRequest(text, slot.options);
}

export function clearGuidedSlot(sessionId: string): void {
  slots.delete(sessionId);
  clearPlanSlot(sessionId);
}

/**
 * A resposta fez o ciclo andar?
 *
 * Sem esta pergunta o slot vira armadilha: o Astro perguntou a conta, o
 * usuário mudou de assunto, e tudo que ele digitou virou tentativa de
 * responder "qual conta" — inclusive "me envie a lista das contas", que
 * voltava "não achei conta com me envie a lista das contas".
 */
function madeProgress(
  before: GuidedSlot,
  resolved: ResolvedClassification,
): boolean {
  if (resolved.kind !== "result") return true;
  const { output } = resolved;
  if ("kind" in output) return true;
  if (output.status === "done" || output.status === "error") return true;
  // Pergunta com seletor: a resposta veio do cartão e é resposta de verdade.
  // Repetir o campo aí é o ASTRO pedindo correção ("telefone inválido"),
  // não o usuário mudando de assunto.
  if (before.hadPicker) return true;
  // Mesma pergunta de novo: a resposta não serviu.
  return resolved.awaitingField !== before.awaitingField;
}

function remember(
  sessionId: string,
  actionKey: string,
  resolved: ResolvedClassification,
): void {
  if (resolved.kind !== "result") return;
  const { output } = resolved;
  const stillAsking =
    !("kind" in output) &&
    (output.status === "needs_input" || output.status === "ambiguous");

  if (!stillAsking) {
    // Concluiu, falhou ou foi para confirmação: o ciclo acabou.
    slots.delete(sessionId);
    return;
  }

  slots.set(sessionId, {
    actionKey,
    fields: toStringFields(resolved.pendingFields ?? {}),
    awaitingField: resolved.awaitingField,
    options: resolved.awaitingOptions,
    hadPicker: Boolean((output as { picker?: unknown }).picker),
    expiresAt: Date.now() + SLOT_TTL_MS,
  });
}

/**
 * Classifica quando é pedido novo; continua de onde parou quando é resposta.
 * `null` = ninguém aqui resolve, segue para o orquestrador.
 */
export async function resolveGuided(params: {
  ctx: AgentContext;
  text: string;
  history?: string[];
  sessionId: string;
}): Promise<ResolvedClassification | null> {
  // Plano em andamento (spec 0033, RF-6): a resposta é de uma das partes.
  const planStep = await continuePlan(params);
  if (planStep === "abandoned") {
    return {
      kind: "result",
      action: getAstroAction("lead.create")!,
      output: {
        status: "error",
        title: "Cancelado",
        description: "Ok, cancelei o plano. Nada foi gravado. O que você quer fazer?",
        appName: "Órbita",
      },
    };
  }
  if (planStep) return planStep;

  const pending = readSlot(params.sessionId);

  if (pending) {
    if (isAbandonPhrase(params.text)) {
      slots.delete(params.sessionId);
      return {
        kind: "result",
        action: getAstroAction(pending.actionKey)!,
        output: {
          status: "error",
          title: "Cancelado",
          description: "Ok, cancelei. Nada foi gravado. O que você quer fazer?",
          appName: "Órbita",
        },
      };
    }

    if (looksLikeNewRequest(params.text, pending.options)) {
      slots.delete(params.sessionId);
    }

    const action = readSlot(params.sessionId) ? getAstroAction(pending.actionKey) : null;
    if (action) {
      const answer = answerToValue(params.text, pending.options);
      const fields = { ...pending.fields };
      if (pending.awaitingField) fields[pending.awaitingField] = answer;

      const resolved = await resolveActionWithFields({
        ctx: params.ctx,
        action,
        rawFields: fields,
        // A frase original some aqui de propósito: "2" não é polaridade de
        // verbo nem nome de ninguém, e lê-la como tal inventaria campo.
        userText: "",
        history: params.history,
      });
      // Só continua o ciclo se ele andou. Repetir a mesma pergunta significa
      // que o usuário falou de outra coisa — aí vale reclassificar.
      if (resolved && madeProgress(pending, resolved)) {
        remember(params.sessionId, pending.actionKey, resolved);
        return resolved;
      }
    }
    slots.delete(params.sessionId);
  }

  // Pergunta contábil não é verbo: pular o classificador poupa tokens e evita
  // que "quanto vou pagar de DAS" vire proposta de lançamento.
  if (isAccountingQuestion(params.text, params.ctx.route) && !matchesAnyIntentPattern(params.text)) {
    return null;
  }

  // Pedido composto vira plano antes de escolher um verbo só.
  const plan = await startPlan(params);
  if (plan) {
    slots.delete(params.sessionId);
    return plan;
  }

  const classification =
    matchIntentPattern(params.text) ??
    (await classifyStaged({
      organizationId: params.ctx.organizationId,
      text: params.text,
      history: params.history,
    }));
  if (!classification) return null;

  const resolved = await resolveClassifiedAction({
    ctx: params.ctx,
    classification,
    userText: params.text,
    history: params.history,
  });
  if (!resolved) return null;

  if (resolved.kind === "result") {
    remember(params.sessionId, resolved.action.key, resolved);
  }
  lastTokensUsed.set(params.sessionId, classification.tokensUsed);
  return resolved;
}

/** Tokens da última triagem — para o custo aparecer no log do WhatsApp. */
const lastTokensUsed = new Map<string, number>();

export function takeLastTokensUsed(sessionId: string): number {
  const used = lastTokensUsed.get(sessionId) ?? 0;
  lastTokensUsed.delete(sessionId);
  return used;
}
