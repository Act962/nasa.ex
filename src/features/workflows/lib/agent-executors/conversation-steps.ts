import "server-only";
import prisma from "@/lib/prisma";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { applyResponseTagsToLead } from "@/features/form/lib/apply-response-tags";
import { deriveResponseLabel } from "@/features/form/lib/derive-response-label";
import { applyAutoNumbers, hasAutoNumberBlock } from "@/features/form-records/lib/auto-number";
import { parseResponse } from "@/features/form-records/lib/response-values";
import { prepareRecordResponse } from "@/features/form-records/server/prepare-record-response";
import { syncFormRecord } from "@/features/form-records/server/sync-form-record";
import { recordLeadEvent } from "@/features/leads/lib/history";
import { applyTagsByAi } from "@/features/tracking-chat-ai/lib/apply-tags-by-ai";
import { sendButtonsToLead } from "@/features/tracking-executions/lib/send-buttons-to-lead";
import { sendLinkToLead } from "@/features/tracking-executions/lib/send-link-to-lead";
import { findOrCreateTags } from "../agent-presets/find-or-create-tags";
import {
  AWAITING_REPLY_KEY,
  CONSENT_OUTPUTS,
  DEFAULT_CONSENT_PAYLOAD,
  DEFAULT_FORM_CHAT_PAYLOAD,
  FORM_CHAT_OUTPUTS,
  MAX_ANSWER_ATTEMPTS,
  interruptOf,
  isFormChatOn,
  normalizeAnswer,
  replyTimeoutMinutesOf,
  stepReplyId,
  stepReplyKey,
  type ConsentPayload,
  type FormChatPayload,
} from "../conversation-steps";
import { listChatFields, lookupValueOf, optionButtonsFor, questionFor, readAnswer, summaryOf, type ChatField, type FieldValue } from "../form-chat";
import type { NodeExecutionResult } from "../run-workflow";
import type { WorkflowContext } from "../workflow-context";

// Passos de conversa (spec 0099): "Pedir aceite" e "Preencher formulário pela conversa". O passo
// envia uma pergunta, o motor suspende a execução e volta ao MESMO passo quando o cliente responde
// (`resumeSameNode`). O que o passo precisa lembrar entre uma mensagem e outra vai no próprio
// resultado dele; as respostas do cliente NÃO: ficam no rascunho da resposta do formulário, para
// dado pessoal não ir para o registro de execuções.

interface StepParams {
  nodeId: string;
  payload: Record<string, unknown>;
  context: WorkflowContext;
  dryRun: boolean;
  leadId: string;
  trackingId: string;
}

interface IncomingReply {
  hasTimedOut: boolean;
  text: string;
  /** A parte do id do botão que é deste passo; `null` quando a resposta foi digitada ou é de outro menu. */
  replyKey: string | null;
  isMedia: boolean;
}

const DISABLED_RESULT: NodeExecutionResult = { output: { error: "form_chat_disabled" }, status: "FAILED", errorMessage: "Passo de conversa desligado neste ambiente" };

function readReply(nodeId: string, context: WorkflowContext): IncomingReply {
  const vars = context.vars ?? {};
  const lastEvent = (vars.lastEvent ?? {}) as { messageText?: unknown; interactiveReplyId?: unknown; mediaType?: unknown };
  return {
    hasTimedOut: vars.lastWaitTimedOut === true,
    text: typeof lastEvent.messageText === "string" ? lastEvent.messageText : "",
    replyKey: stepReplyKey(nodeId, lastEvent.interactiveReplyId),
    isMedia: typeof lastEvent.mediaType === "string" && lastEvent.mediaType.length > 0,
  };
}

/** O que este passo deixou guardado na vez anterior, se ele estava esperando resposta. */
function waitingStateOf<TState>(nodeId: string, context: WorkflowContext): TState | null {
  const previous = (context.nodeOutputs?.[nodeId] ?? null) as { isWaitingReply?: unknown; state?: unknown } | null;
  return previous?.isWaitingReply === true ? ((previous.state ?? {}) as TState) : null;
}

/**
 * Marca, na mensagem que acabou de sair, que o fluxo espera a resposta do cliente. É por aí que o
 * atendimento sabe que a próxima mensagem não é para a assistente (D-6).
 */
export async function markAwaitingReply(params: { leadId: string; trackingId: string; nodeId: string; timeoutMinutes: number }): Promise<void> {
  const conversation = await prisma.conversation.findFirst({ where: { leadId: params.leadId, trackingId: params.trackingId }, select: { id: true } });
  if (!conversation) return;
  const lastSent = await prisma.message.findFirst({
    where: { conversationId: conversation.id, fromMe: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, metadata: true },
  });
  if (!lastSent) return;
  const currentMetadata = lastSent.metadata && typeof lastSent.metadata === "object" && !Array.isArray(lastSent.metadata) ? (lastSent.metadata as Record<string, unknown>) : {};
  const expiresAt = new Date(Date.now() + params.timeoutMinutes * 60_000).toISOString();
  await prisma.message.update({
    where: { id: lastSent.id },
    data: { metadata: { ...currentMetadata, [AWAITING_REPLY_KEY]: { nodeId: params.nodeId, expiresAt } } as object },
  });
}

async function ask(params: StepParams, question: { text: string; options?: { key: string; title: string }[] }): Promise<void> {
  if (question.options && question.options.length > 0) {
    await sendButtonsToLead({
      leadId: params.leadId,
      trackingId: params.trackingId,
      bodyText: question.text,
      buttons: question.options.map((option) => ({ id: stepReplyId(params.nodeId, option.key), text: option.title })),
      menuFormat: question.options.length > 3 ? "LIST" : "BUTTON",
      listButton: "Ver opções",
    });
  } else {
    await sendLinkToLead({ leadId: params.leadId, trackingId: params.trackingId, body: question.text });
  }
  await markAwaitingReply({ leadId: params.leadId, trackingId: params.trackingId, nodeId: params.nodeId, timeoutMinutes: replyTimeoutMinutesOf(params.payload) });
}

function waitFor<TState>(params: StepParams, state: TState): NodeExecutionResult {
  return {
    status: "WAITING",
    output: { isWaitingReply: true, resumeSameNode: true, state, eventNames: ["message-incoming"], timeoutMinutes: replyTimeoutMinutesOf(params.payload) },
  };
}

function finish(chosenOutput: string, detail: Record<string, unknown> = {}): NodeExecutionResult {
  return { chosenOutput, output: { isWaitingReply: false, finishedBy: chosenOutput, ...detail } };
}

function failed(error: unknown): NodeExecutionResult {
  const errorMessage = error instanceof Error ? error.message : "conversation_step_failed";
  return { output: { isWaitingReply: false, error: errorMessage }, status: "FAILED", errorMessage };
}

// ─── Pedir aceite ──────────────────────────────────

const CONSENT_TAG = { slug: "aceitou-os-termos", name: "Aceitou os termos", color: "#16a34a" };
const SAYS_YES = /^(sim|s|aceito|concordo|ok|pode|claro|1)\b/;

/** Identifica o texto apresentado: mudou o texto ou o link, é outro aceite. */
function termsVersionOf(payload: ConsentPayload): string {
  const source = `${payload.termsText.trim()}|${payload.policyUrl.trim()}`;
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

async function tagAsAccepted(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { tracking: { select: { organizationId: true } } } });
  if (!lead) return;
  const tagResult = await prisma.$transaction((tx) => findOrCreateTags(tx, lead.tracking.organizationId, [CONSENT_TAG]));
  const tagId = tagResult.tagMap[CONSENT_TAG.slug];
  if (!tagId) return;
  const alreadyTagged = await prisma.leadTag.findUnique({ where: { leadId_tagId: { leadId, tagId } }, select: { leadId: true } });
  if (!alreadyTagged) await applyTagsByAi({ leadId, tagIds: [tagId] });
}

export async function runConsentStep(params: StepParams): Promise<NodeExecutionResult> {
  if (!isFormChatOn()) return DISABLED_RESULT;
  const payload = { ...DEFAULT_CONSENT_PAYLOAD, ...params.payload } as ConsentPayload;
  const termsVersion = termsVersionOf(payload);
  if (params.dryRun) return { chosenOutput: CONSENT_OUTPUTS.accepted, output: { dryRun: true, type: "CONSENT", preview: payload.termsText.slice(0, 200) } };

  try {
    const waiting = waitingStateOf<{ termsVersion?: string }>(params.nodeId, params.context);
    if (waiting) {
      const reply = readReply(params.nodeId, params.context);
      const hasAccepted = !reply.hasTimedOut && (reply.replyKey === "yes" || (reply.replyKey === null && SAYS_YES.test(normalizeAnswer(reply.text))));
      // O registro guarda o que foi apresentado, para provar o que foi aceito (spec 0099, RF-13).
      await trackLeadEvent({
        leadId: params.leadId,
        kind: hasAccepted ? "consent_accepted" : "consent_refused",
        metadata: { termsVersion, termsText: payload.termsText, policyUrl: payload.policyUrl || null, source: "workflow", hasTimedOut: reply.hasTimedOut },
      });
      if (hasAccepted) await tagAsAccepted(params.leadId).catch((error: unknown) => console.error("[consent-step] tag do aceite não aplicada", error));
      return finish(hasAccepted ? CONSENT_OUTPUTS.accepted : CONSENT_OUTPUTS.refused, { termsVersion });
    }

    if (payload.askOnce) {
      const previousAcceptance = await prisma.leadJourneyEvent.findFirst({
        where: { leadId: params.leadId, kind: "consent_accepted", metadata: { path: ["termsVersion"], equals: termsVersion } },
        select: { id: true },
      });
      if (previousAcceptance) return finish(CONSENT_OUTPUTS.accepted, { termsVersion, hadAcceptedBefore: true });
    }

    const policyLine = payload.policyUrl.trim() ? `\n\nPolítica de privacidade: ${payload.policyUrl.trim()}` : "";
    await ask(params, {
      text: `${payload.termsText.trim()}${policyLine}`,
      options: [
        { key: "yes", title: payload.acceptLabel.trim().slice(0, 20) || DEFAULT_CONSENT_PAYLOAD.acceptLabel },
        { key: "no", title: payload.refuseLabel.trim().slice(0, 20) || DEFAULT_CONSENT_PAYLOAD.refuseLabel },
      ],
    });
    return waitFor(params, { termsVersion });
  } catch (error) {
    return failed(error);
  }
}

// ─── Preencher formulário pela conversa ────────────

type FormChatPhase = "asking" | "not_in_list" | "summary" | "choosing_correction";

interface FormChatState {
  phase: FormChatPhase;
  /** Rascunho da resposta do formulário: é nele que ficam as respostas do cliente. */
  responseId: string | null;
  /** Campo que está sendo perguntado. */
  fieldId: string | null;
  attempts: number;
  /** Depois de corrigir um campo pelo resumo, volta para o resumo em vez de seguir a ordem. */
  isCorrecting: boolean;
}

const GAVE_UP_MESSAGE = "Não consegui entender a resposta. Vamos deixar o cadastro para depois.";
const WRITE_IT_MESSAGE = "Escreva a resposta, por favor.";

async function loadFormForLead(formId: string, leadId: string) {
  const [form, lead] = await Promise.all([
    prisma.form.findUnique({ where: { id: formId }, select: { id: true, name: true, organizationId: true, jsonBlock: true } }),
    prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, name: true, email: true, phone: true, document: true, tracking: { select: { organizationId: true } } } }),
  ]);
  // Formulário de outra empresa é tratado como formulário que não existe.
  if (!form || !lead || form.organizationId !== lead.tracking.organizationId) return null;
  // Endereço que o cliente já deu no pedido do catálogo (spec 0104): não é perguntado de novo.
  const latestOrder = await prisma.catalogOrder.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" }, select: { delivery: true } });
  const deliveryAddress = (latestOrder?.delivery as { address?: string | null } | null)?.address ?? null;
  return { form, lead: { ...lead, deliveryAddress } };
}

async function readDraft(responseId: string | null): Promise<Record<string, FieldValue>> {
  if (!responseId) return {};
  const draft = await prisma.formResponses.findUnique({ where: { id: responseId }, select: { jsonResponse: true } });
  return parseResponse(draft?.jsonResponse) as Record<string, FieldValue>;
}

async function saveDraft(params: { responseId: string | null; formId: string; leadId: string; answers: Record<string, FieldValue> }): Promise<string> {
  const jsonResponse = JSON.stringify(params.answers);
  if (params.responseId) {
    await prisma.formResponses.update({ where: { id: params.responseId }, data: { jsonResponse } });
    return params.responseId;
  }
  const created = await prisma.formResponses.create({ data: { formId: params.formId, leadId: params.leadId, jsonResponse, authorKind: "LEAD" }, select: { id: true } });
  return created.id;
}

/** Grava a resposta como um envio normal do formulário, com a ficha ligada ao lead. */
async function finalizeResponse(params: { responseId: string; form: { id: string; organizationId: string; jsonBlock: unknown }; leadId: string; fields: ChatField[]; answers: Record<string, FieldValue> }): Promise<void> {
  const pricedResponse = await prepareRecordResponse({ organizationId: params.form.organizationId, jsonBlock: params.form.jsonBlock, response: JSON.stringify(params.answers) });
  const autoNumberSequence = hasAutoNumberBlock(params.form.jsonBlock)
    ? (await prisma.form.update({ where: { id: params.form.id }, data: { autoNumberCounter: { increment: 1 } }, select: { autoNumberCounter: true } })).autoNumberCounter
    : undefined;
  const response = applyAutoNumbers({ jsonBlock: params.form.jsonBlock, response: pricedResponse, sequence: autoNumberSequence });
  const label = deriveResponseLabel({ jsonBlock: params.form.jsonBlock, jsonResponse: response });

  await prisma.$transaction(async (tx) => {
    await tx.formResponses.update({ where: { id: params.responseId }, data: { jsonResponse: response, label, completedAt: new Date() } });
    await tx.form.update({ where: { id: params.form.id }, data: { responses: { increment: 1 } } });
    await applyResponseTagsToLead(tx, params.leadId, response);
    // Dados do lead que o formulário espelha. O telefone não entra: é o número da própria conversa.
    const leadUpdate: { name?: string; email?: string; document?: string } = {};
    for (const field of params.fields) {
      const answered = params.answers[field.id]?.value?.trim();
      if (!answered) continue;
      if (field.leadSource === "name") leadUpdate.name = answered;
      if (field.leadSource === "email") leadUpdate.email = answered.toLowerCase();
      if (field.leadSource === "document") leadUpdate.document = answered;
    }
    if (Object.keys(leadUpdate).length > 0) await tx.lead.update({ where: { id: params.leadId }, data: leadUpdate });
  });

  // Depois do commit e sem derrubar o cadastro já gravado (Regra 18).
  await syncFormRecord({ responseId: params.responseId, isFinal: true });
  await recordLeadEvent({ leadId: params.leadId, eventType: "FORM_SUBMITTED", metadata: { formResponseId: params.responseId, formId: params.form.id, source: "workflow_chat", label } }).catch((error: unknown) =>
    console.error("[form-chat] evento do lead não registrado", error),
  );
}

function leadValueFor(field: ChatField, lead: { name: string; email: string | null; phone: string | null; document: string | null; deliveryAddress?: string | null }): string | null {
  if (field.leadSource === "address") return lead.deliveryAddress ?? null;
  if (field.leadSource === "name") return lead.name && lead.name !== "Sem nome" ? lead.name : null;
  if (field.leadSource === "email") return lead.email;
  if (field.leadSource === "phone") return lead.phone;
  if (field.leadSource === "document") return lead.document;
  return null;
}

function askField(params: StepParams, field: ChatField, prefix = ""): Promise<void> {
  return ask(params, { text: `${prefix}${questionFor(field)}`, options: optionButtonsFor(field) ?? undefined });
}

export async function runFormChatStep(params: StepParams): Promise<NodeExecutionResult> {
  if (!isFormChatOn()) return DISABLED_RESULT;
  const payload = { ...DEFAULT_FORM_CHAT_PAYLOAD, ...params.payload } as FormChatPayload;
  if (params.dryRun) return { chosenOutput: FORM_CHAT_OUTPUTS.done, output: { dryRun: true, type: "FORM_CHAT", fields: payload.fieldIds.length } };

  try {
    const loaded = await loadFormForLead(payload.formId, params.leadId);
    if (!loaded) return { output: { isWaitingReply: false, error: "form_not_found" }, status: "FAILED", errorMessage: "Formulário não encontrado nesta empresa" };
    const { form, lead } = loaded;
    const availableFields = listChatFields(form.jsonBlock);
    // A ordem é a que a pessoa marcou no passo; campo que saiu do formulário é ignorado.
    const fields = payload.fieldIds.flatMap((fieldId) => availableFields.filter((field) => field.id === fieldId));
    if (fields.length === 0) return { output: { isWaitingReply: false, error: "no_fields" }, status: "FAILED", errorMessage: "Nenhum campo do passo existe mais no formulário" };

    const waiting = waitingStateOf<FormChatState>(params.nodeId, params.context);
    let state: FormChatState = waiting ?? { phase: "asking", responseId: null, fieldId: null, attempts: 0, isCorrecting: false };
    const answers = await readDraft(state.responseId);

    const persist = async () => {
      state = { ...state, responseId: await saveDraft({ responseId: state.responseId, formId: form.id, leadId: lead.id, answers }) };
    };
    const nextUnanswered = () => fields.find((field) => answers[field.id] === undefined) ?? null;
    const showSummary = async (): Promise<NodeExecutionResult> => {
      await ask(params, { text: summaryOf(fields, answers), options: [{ key: "confirm", title: "Sim" }, { key: "fix", title: "Corrigir" }] });
      state = { ...state, phase: "summary", fieldId: null, attempts: 0, isCorrecting: false };
      return waitFor(params, state);
    };
    const complete = async (): Promise<NodeExecutionResult> => {
      await persist();
      await finalizeResponse({ responseId: state.responseId!, form, leadId: lead.id, fields, answers });
      return finish(FORM_CHAT_OUTPUTS.done, { responseId: state.responseId, answeredFields: fields.length });
    };
    const advance = async (): Promise<NodeExecutionResult> => {
      const nextField = state.isCorrecting ? null : nextUnanswered();
      if (nextField) {
        await askField(params, nextField);
        state = { ...state, phase: "asking", fieldId: nextField.id, attempts: 0 };
        return waitFor(params, state);
      }
      return payload.showSummary ? showSummary() : complete();
    };

    // Primeira vez no passo: o que o lead já tem não é perguntado de novo.
    if (!waiting) {
      if (payload.askOnlyMissing) {
        for (const field of fields) {
          const known = leadValueFor(field, lead);
          if (!known) continue;
          const prefilled = readAnswer(field, { text: known, optionKey: null });
          if (prefilled.isValid) answers[field.id] = prefilled.value;
        }
        if (Object.keys(answers).length > 0) await persist();
      }
      return advance();
    }

    const reply = readReply(params.nodeId, params.context);
    if (reply.hasTimedOut) return finish(FORM_CHAT_OUTPUTS.gaveUp, { reason: "timeout", responseId: state.responseId });
    const interrupt = reply.replyKey === null ? interruptOf(reply.text) : null;
    if (interrupt === "human") return finish(FORM_CHAT_OUTPUTS.human, { responseId: state.responseId });
    if (interrupt === "leave") return finish(FORM_CHAT_OUTPUTS.gaveUp, { reason: "left", responseId: state.responseId });

    const retryOrGiveUp = async (message: string, again: () => Promise<void>): Promise<NodeExecutionResult> => {
      if (state.attempts + 1 >= MAX_ANSWER_ATTEMPTS) {
        await sendLinkToLead({ leadId: params.leadId, trackingId: params.trackingId, body: GAVE_UP_MESSAGE });
        return finish(FORM_CHAT_OUTPUTS.gaveUp, { reason: "attempts", responseId: state.responseId });
      }
      state = { ...state, attempts: state.attempts + 1 };
      await sendLinkToLead({ leadId: params.leadId, trackingId: params.trackingId, body: message });
      await again();
      return waitFor(params, state);
    };

    if (state.phase === "summary") {
      const isConfirmed = reply.replyKey === "confirm" || (reply.replyKey === null && SAYS_YES.test(normalizeAnswer(reply.text)));
      if (isConfirmed) return complete();
      await ask(params, { text: "Qual dado você quer corrigir?", options: fields.map((field, fieldIndex) => ({ key: `fix-${fieldIndex}`, title: field.label.replace(/[:?\s]+$/, "").slice(0, 24) })) });
      state = { ...state, phase: "choosing_correction", attempts: 0 };
      return waitFor(params, state);
    }

    if (state.phase === "choosing_correction") {
      const normalized = normalizeAnswer(reply.text);
      const chosenIndex = reply.replyKey?.startsWith("fix-") ? Number(reply.replyKey.slice(4)) : /^\d{1,2}$/.test(normalized) ? Number(normalized) - 1 : fields.findIndex((field) => normalizeAnswer(field.label).startsWith(normalized) && normalized.length > 2);
      const fieldToFix = fields[chosenIndex];
      if (!fieldToFix) return retryOrGiveUp("Escolha um dos dados da lista, por favor.", () => ask(params, { text: "Qual dado você quer corrigir?", options: fields.map((field, fieldIndex) => ({ key: `fix-${fieldIndex}`, title: field.label.replace(/[:?\s]+$/, "").slice(0, 24) })) }));
      await askField(params, fieldToFix);
      state = { ...state, phase: "asking", fieldId: fieldToFix.id, attempts: 0, isCorrecting: true };
      return waitFor(params, state);
    }

    const field = fields.find((candidate) => candidate.id === state.fieldId);
    if (!field) return advance();

    if (state.phase === "not_in_list") {
      const fallbackOption = payload.fallbackOptionByField[field.id];
      if (reply.replyKey === "default" && fallbackOption) {
        answers[field.id] = lookupValueOf(field, fallbackOption);
        await persist();
        state = { ...state, isCorrecting: state.isCorrecting };
        return state.isCorrecting ? showSummary() : advance();
      }
      if (reply.replyKey === "human") return finish(FORM_CHAT_OUTPUTS.human, { responseId: state.responseId });
      if (reply.replyKey === "retry") {
        await askField(params, field);
        state = { ...state, phase: "asking" };
        return waitFor(params, state);
      }
      // Digitou de novo em vez de tocar num botão: vale como nova tentativa do campo.
      state = { ...state, phase: "asking" };
    }

    if (reply.isMedia && !reply.text.trim()) return retryOrGiveUp(WRITE_IT_MESSAGE, () => askField(params, field));
    const answer = readAnswer(field, { text: reply.text, optionKey: reply.replyKey });
    if (answer.isValid) {
      answers[field.id] = answer.value;
      await persist();
      return state.isCorrecting ? showSummary() : advance();
    }
    if (answer.reason === "not_in_list") {
      if (state.attempts + 1 >= MAX_ANSWER_ATTEMPTS) {
        await sendLinkToLead({ leadId: params.leadId, trackingId: params.trackingId, body: GAVE_UP_MESSAGE });
        return finish(FORM_CHAT_OUTPUTS.gaveUp, { reason: "attempts", responseId: state.responseId });
      }
      const fallbackOption = payload.fallbackOptionByField[field.id];
      await ask(params, {
        text: `${answer.message} Como prefere seguir?`,
        options: [
          { key: "retry", title: "Digitar novamente" },
          ...(fallbackOption ? [{ key: "default", title: fallbackOption.slice(0, 20) }] : []),
          { key: "human", title: "Falar com atendente" },
        ],
      });
      state = { ...state, phase: "not_in_list", attempts: state.attempts + 1 };
      return waitFor(params, state);
    }
    return retryOrGiveUp(answer.message, () => askField(params, field));
  } catch (error) {
    return failed(error);
  }
}
