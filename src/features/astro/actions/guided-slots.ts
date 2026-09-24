import "server-only";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { getAstroAction } from "./registry";
import { classifyStaged } from "./classify-staged";
import { ASKS, WRITE_VERB, normalizeQuestion } from "@/features/astro/queries/types";
import {
  resolveActionWithFields,
  resolveClassifiedAction,
  type ResolvedClassification,
} from "./resolve-action";

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
export function shouldSkipReading(sessionId: string, text: string): boolean {
  const slot = readSlot(sessionId);
  if (!slot) return false;
  return !looksLikeNewRequest(text, slot.options);
}

export function clearGuidedSlot(sessionId: string): void {
  slots.delete(sessionId);
}

/** Escapes explícitos: o usuário desiste e precisa ser ouvido na hora. */
const ABANDON = /^(cancela|cancelar|esquece|esqueca|deixa|deixa pra la|para|parar|zerar|zera|limpa|limpar|recomecar|recomeca|sair|nao quero)\b/;

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
  // Mesma pergunta de novo: a resposta não serviu.
  return resolved.awaitingField !== before.awaitingField;
}

/**
 * Isto é resposta à pergunta, ou assunto novo?
 *
 * "Me envie a lista das contas", respondendo a "em qual conta?", virava o
 * NOME de uma conta inexistente — e o Astro respondia "não achei conta com
 * me envie a lista das contas". Resposta é curta, ou casa com uma das opções
 * oferecidas. Pedido novo tem verbo e tamanho.
 */
function looksLikeNewRequest(text: string, options?: { label: string }[]): boolean {
  const normalized = normalizeQuestion(text);
  if (options?.some((option) => normalizeQuestion(option.label) === normalized)) {
    return false;
  }
  // Pergunta é sempre assunto novo: ninguém responde "em qual conta?" com
  // "quantos leads temos?". Ordem precisa de corpo — "2" e "Banco Teste"
  // também começam frase, mas não são pedido.
  if (ASKS.test(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  return words.length > 3 && WRITE_VERB.test(normalized);
}

/** "2" responde a lista; "Nu bank" também. Número só vale dentro da faixa. */
function answerToValue(
  text: string,
  options?: { id: string; label: string }[],
): string {
  const trimmed = text.trim();
  if (!options || options.length === 0) return trimmed;
  const index = Number(trimmed);
  if (Number.isInteger(index) && index >= 1 && index <= options.length) {
    return options[index - 1].label;
  }
  return trimmed;
}

/** Só strings entram no slot; o resto se reconstrói no `buildActionInput`. */
function toStringFields(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = typeof value === "string" ? value : String(value);
  }
  return out;
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
  const pending = readSlot(params.sessionId);

  if (pending) {
    const normalized = params.text
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (ABANDON.test(normalized)) {
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

  const classification = await classifyStaged({
    organizationId: params.ctx.organizationId,
    text: params.text,
    history: params.history,
  });
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
