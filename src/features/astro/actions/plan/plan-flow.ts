import "server-only";
import prisma from "@/lib/prisma";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { createPendingAction } from "@/features/astro/server/tools/_shared/proposals/create-proposal";
import { parsePickedAnswer } from "@/features/astro/lib/astro-picker";
import { getAstroAction } from "../registry";
import { parseCalendarDate } from "../parse-when";
import { resolveActionWithFields, shortLabel, type ResolvedClassification } from "../resolve-action";
import { answerToValue, isAbandonPhrase, looksLikeNewRequest, toStringFields } from "../guided-answers";
import type { AstroAction, AstroActionResult } from "../types";
import { DESTRUCTIVE_ACTIONS, LEAD_FIELD, draftPlan, type PlanPart } from "./build-plan";
import { PLAN_ACTION_TYPE, type PlanPayloadPart } from "./execute-plan";

// Ciclo do plano (spec 0033, RF-6): cada parte passa pelo roteiro do seu verbo
// — mesmos seletores, mesmo ensaio —, e só no fim um cartão único confirma
// tudo. O estado vive em memória por sessão, como o ciclo de um verbo.

const PLAN_TTL_MS = 15 * 60_000;
const PRONOUN = /\b(ele|ela|dele|dela|nele|nela)\b/i;
/** Resposta que o roteiro de agenda entende como "sem lead" — ensaio sem alvo. */
const NO_LEAD_ANSWER = "sem lead";

interface PlanSlot {
  parts: PlanPart[];
  current: number;
  awaitingField?: string;
  options?: { id: string; label: string }[];
  expiresAt: number;
}

const globalForPlans = globalThis as unknown as { astroPlanSlots?: Map<string, PlanSlot> };
const planSlots = (globalForPlans.astroPlanSlots ??= new Map<string, PlanSlot>());

export function readPlanSlot(sessionId: string): PlanSlot | null {
  const slot = planSlots.get(sessionId);
  if (!slot) return null;
  if (slot.expiresAt < Date.now()) {
    planSlots.delete(sessionId);
    return null;
  }
  return slot;
}

export function clearPlanSlot(sessionId: string): void {
  planSlots.delete(sessionId);
}

function actionLabel(part: PlanPart): string {
  if (part.actionKey === "payment.receipt") return "Enviar comprovante";
  const action = getAstroAction(part.actionKey);
  if (!action) return "Parte não reconhecida";
  return action.confirmTitle ?? shortLabel(action.description);
}

function leadValueOf(part: PlanPart): string | undefined {
  const field = LEAD_FIELD[part.actionKey];
  return field ? part.fields[field] : undefined;
}

/** Liga a parte às anteriores: lead de "ele", funil das etapas, lembrete relativo. */
function prepareParts(parts: PlanPart[], index: number): void {
  const part = parts[index];
  if (part.prepared) return;
  part.prepared = true;

  const leadField = LEAD_FIELD[part.actionKey];
  if (leadField && part.actionKey !== "lead.create" && (!part.fields[leadField] || PRONOUN.test(part.clause))) {
    for (let source = index - 1; source >= 0; source--) {
      const value = leadValueOf(parts[source]);
      if (!value) continue;
      part.fields[leadField] = value;
      part.leadFrom = source;
      // Herdou de quem herdou de um lead novo: depende da mesma criação.
      if (parts[source].actionKey === "lead.create") part.dependsOn = source;
      else if (parts[source].leadFrom !== undefined) part.dependsOn = parts[source].dependsOn;
      break;
    }
  }

  if (part.trackingFrom !== undefined) {
    const trackingName = parts[part.trackingFrom].fields.trackingName;
    if (trackingName) part.fields.trackingName = trackingName;
  }

  // "avisa ela no WhatsApp" sem texto: o aviso é o resultado da parte anterior.
  if (part.actionKey === "chat.send_message" && !part.fields.message && index > 0) {
    part.messageFrom = index - 1;
  }
  if (part.messageFrom !== undefined) {
    part.fields.message = `Mensagem com o resultado da parte ${part.messageFrom + 1}`;
  }

  if (part.daysBefore) {
    const entry = parts[part.daysBefore.from].fields;
    const dueIso = entry.dueDate ? parseCalendarDate(parsePickedAnswer(entry.dueDate).label) : null;
    part.fields.message = `Pagar ${parsePickedAnswer(entry.description ?? "a conta").label}`;
    part.fields.recurrence = "uma vez";
    part.fields.remindTime = "09:00";
    if (dueIso) {
      const remindAt = new Date(new Date(dueIso).getTime() - part.daysBefore.days * 24 * 60 * 60_000);
      part.fields.firstRemindAt = remindAt.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
      });
    } else {
      part.failure = "Não sei o vencimento do lançamento para contar os dias antes.";
    }
  }
}

/** O comprovante só existe se foi anexado ao lançamento — e o ASTRO não o inventa. */
async function checkReceipt(ctx: AgentContext, parts: PlanPart[], part: PlanPart): Promise<void> {
  const source = parts[part.receiptFrom!];
  const picked = parsePickedAnswer(source.fields.description ?? "");
  const entry = await prisma.paymentEntry.findFirst({
    where: {
      organizationId: ctx.organizationId,
      ...(picked.id ? { id: picked.id } : { description: { contains: picked.label, mode: "insensitive" } }),
    },
    select: { description: true, attachmentUrl: true },
  });
  part.failure = entry?.attachmentUrl
    ? `O ASTRO ainda não envia comprovante pelo WhatsApp. O de "${entry.description}" está em ${entry.attachmentUrl}.`
    : `"${entry?.description ?? picked.label}" não tem comprovante anexado — não há o que mandar. Anexe no Financeiro e peça de novo.`;
}

function withPartPrefix(output: AstroActionResult, index: number, total: number): AstroActionResult {
  return { ...output, title: `Parte ${index + 1} de ${total} · ${output.title}` };
}

type PlanStep = ResolvedClassification | null;

/** Segue de onde parou: pergunta o próximo dado ou, com tudo pronto, mostra o cartão. */
async function advancePlan(ctx: AgentContext, sessionId: string, slot: PlanSlot): Promise<PlanStep> {
  const { parts } = slot;
  for (let index = slot.current; index < parts.length; index++) {
    const part = parts[index];
    prepareParts(parts, index);
    if (part.failure || part.ready) continue;
    if (part.actionKey === "payment.receipt") {
      await checkReceipt(ctx, parts, part);
      continue;
    }
    const action = getAstroAction(part.actionKey);
    if (!action) {
      part.failure = "Parte não reconhecida.";
      continue;
    }

    // Alvo que nasce numa parte anterior ainda não existe: sem ensaio contra o
    // banco. Na agenda, o roteiro roda "sem lead" e o lead volta no fim.
    const targetNotCreatedYet = part.dependsOn !== undefined;
    const rehearsesWithoutLead = targetNotCreatedYet && part.actionKey === "appointment.create";
    const realLead = part.fields.leadName;
    const rawFields = rehearsesWithoutLead ? { ...part.fields, leadName: NO_LEAD_ANSWER } : part.fields;

    const resolved = await resolveActionWithFields({
      ctx,
      action,
      rawFields,
      userText: "",
      history: [],
      collectOnly: true,
      skipRehearsal: targetNotCreatedYet && !rehearsesWithoutLead,
    });
    if (!resolved || resolved.kind !== "result" || "kind" in resolved.output) {
      part.failure = "Não consegui preparar esta parte.";
      continue;
    }
    part.fields = toStringFields(resolved.pendingFields ?? {});
    if (rehearsesWithoutLead && realLead) part.fields.leadName = realLead;

    const { output } = resolved;
    if (output.status === "done") {
      part.ready = true;
      part.input = { ...(resolved.readyInput ?? {}), ...(rehearsesWithoutLead && realLead ? { leadName: realLead } : {}) };
      part.summary = output.description || (targetNotCreatedYet ? `Usa o que a parte ${part.dependsOn! + 1} criar.` : "");
      continue;
    }
    if (output.status === "error") {
      part.failure = output.description;
      continue;
    }

    slot.current = index;
    slot.awaitingField = resolved.awaitingField;
    slot.options = resolved.awaitingOptions;
    slot.expiresAt = Date.now() + PLAN_TTL_MS;
    planSlots.set(sessionId, slot);
    return { ...resolved, output: withPartPrefix(output, index, parts.length) };
  }

  planSlots.delete(sessionId);
  return presentPlan(ctx, parts);
}

function lineValue(part: PlanPart): string {
  if (part.failure) return `❌ ${part.failure}`;
  if (DESTRUCTIVE_ACTIONS.has(part.actionKey)) {
    return `${part.summary ? `${part.summary} ` : ""}Pede confirmação separada, depois do plano.`;
  }
  return part.summary || "Pronto para executar.";
}

async function presentPlan(ctx: AgentContext, parts: PlanPart[]): Promise<PlanStep> {
  const firstAction = getAstroAction(parts.find((part) => getAstroAction(part.actionKey))?.actionKey ?? "") as
    | AstroAction
    | undefined;
  if (!firstAction) return null;

  const runnable = parts.filter((part) => part.ready);
  if (runnable.length === 0) {
    return {
      kind: "result",
      action: firstAction,
      output: {
        status: "error",
        title: "Nenhuma parte pode ser feita",
        description: parts.map((part, index) => `${index + 1}. ${actionLabel(part)}: ${lineValue(part)}`).join("\n"),
        appName: "Órbita",
      },
    };
  }

  const payloadParts: PlanPayloadPart[] = parts.map((part) => ({
    actionKey: part.actionKey,
    label: actionLabel(part),
    input: part.input,
    failure: part.failure,
    dependsOn: part.dependsOn,
    messageFrom: part.messageFrom,
    destructive: DESTRUCTIVE_ACTIONS.has(part.actionKey),
  }));

  const card = await createPendingAction({
    ctx,
    actionType: PLAN_ACTION_TYPE,
    payload: { parts: payloadParts } as unknown as Record<string, unknown>,
    title: `Confirmar plano com ${parts.length} partes`,
    lines: parts.map((part, index) => ({ label: `${index + 1}. ${actionLabel(part)}`, value: lineValue(part) })),
    warnings: [
      "Cada parte roda na ordem e volta com ✅ ou ❌. A que depende de outra que falhar fica suspensa.",
      ...parts.flatMap((part) => getAstroAction(part.actionKey)?.confirmWarnings ?? []),
    ].filter((warning, index, all) => all.indexOf(warning) === index),
  });
  return { kind: "result", action: firstAction, output: card };
}

/** Pedido composto? Monta o plano e começa pela primeira pergunta. */
export async function startPlan(params: {
  ctx: AgentContext;
  text: string;
  sessionId: string;
}): Promise<PlanStep> {
  const draft = await draftPlan(params.ctx, params.text);
  if (!draft) return null;
  if (draft.kind === "too_many") {
    const action = getAstroAction("lead.create")!;
    return {
      kind: "result",
      action,
      output: {
        status: "error",
        title: "Pedido grande demais",
        description: `Entendi ${draft.count} pedidos numa frase só. Mande até 3 por vez para eu não misturar nada.`,
        appName: "Órbita",
      },
    };
  }
  return advancePlan(params.ctx, params.sessionId, {
    parts: draft.parts,
    current: 0,
    expiresAt: Date.now() + PLAN_TTL_MS,
  });
}

/**
 * Resposta a uma pergunta do plano. `null` = não era resposta (assunto novo):
 * o plano é descartado e quem chama trata a frase do zero.
 */
export async function continuePlan(params: {
  ctx: AgentContext;
  text: string;
  sessionId: string;
}): Promise<PlanStep | "abandoned"> {
  const slot = readPlanSlot(params.sessionId);
  if (!slot) return null;
  if (isAbandonPhrase(params.text)) {
    planSlots.delete(params.sessionId);
    return "abandoned";
  }
  if (!parsePickedAnswer(params.text).id && looksLikeNewRequest(params.text, slot.options)) {
    planSlots.delete(params.sessionId);
    return null;
  }
  const part = slot.parts[slot.current];
  if (slot.awaitingField) part.fields[slot.awaitingField] = answerToValue(params.text, slot.options);
  return advancePlan(params.ctx, params.sessionId, slot);
}
