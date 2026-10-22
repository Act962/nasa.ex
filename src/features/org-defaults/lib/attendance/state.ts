import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { broadcastAgentWorkflowEvent, dispatchAiFinished } from "@/inngest/utils";
import { getLastLeadMessage } from "@/features/tracking-executions/lib/lead-message";
import { parseAiCapabilities, type AttendanceSettings } from "@/features/tracking-chat-ai/lib/capabilities";
import { isAttendanceManagedChannel, isAttendanceStateConfigured, isAttendanceStateEnabled } from "./flag";
import { mirrorStatusFlowTags, type AttendanceStatusFlow } from "./tags";
import {
  ensureOpenSection,
  findOpenSection,
  patchSection,
  patchSectionIf,
  closeSection,
  type SectionOutcome,
  type SectionState,
} from "./section";
import { recordAttendanceScore } from "./score";
import { looksLikeDelayComplaint } from "./complaint";
import { hasAiTakenOver, hasCompanyTalked, isAiHeldBySection, isHandoffWaiting, isHumanInConversation, isHumanReplyRecent } from "./ai-hold";
import { sendAttendanceFixedMessage, type FixedMessageKind } from "./fixed-message";
import { notifyUnattendedLead, MAX_OWNER_WHATSAPP_NOTICES } from "./owner-notice";
import { applyInboundAutoTags, type InboundChannel } from "../auto-tags";

// Estado de atendimento (spec 0113). O estado é o `Lead.statusFlow`. Se a IA pode responder agora é calculado
// (`isAiHeldByAttendance` e `Lead.lastHumanReplyAt`), nunca guardado. Cada espera vira UM evento atrasado
// (`attendance/check`); quem acorda confere se ainda vale, trava a seção e só então age. A seção é lida e
// gravada só na primeira mensagem de cada espera (revisão 9.1): as seguintes custam uma ida ao banco.

export const ATTENDANCE_CHECK_EVENT = "attendance/check";
export const AI_MESSAGE_EVENT = "chat/ai.whatsapp-message-received";

export type AttendanceCheckStage = "holding" | "ai_step_in" | "handoff_resume" | "owner_notice";
type AttendanceAiTrigger = "attendance-step-in" | "attendance-in-service" | "attendance-handoff-resume";

/** Checagem das empresas no estado de atendimento: lê e trava a seção. */
export interface AttendanceCheckEventData {
  organizationId: string;
  leadId: string;
  sectionId: string;
  stage: AttendanceCheckStage;
  /** Momento que a checagem confere: o início da espera ou o pedido de humano. */
  anchorAt: string;
  dueAt: string;
  noticeNumber?: number;
  /** Na espera da transferência a mensagem fixa é a de "consultor", e a IA volta pelo `handoff_resume`. */
  isHandoffWait?: boolean;
  /** Entrada da IA pedida pela reclamação: não pode cair no id do `ai_step_in` que a mensagem fixa já agendou. */
  isComplaint?: boolean;
}

/**
 * "O atendente sumiu" (todas as empresas): o cliente escreveu com a IA calada por resposta humana recente.
 * Só lê as colunas do lead, sem seção.
 */
export interface HumanAbsentCheckEventData {
  stage: "human_absent";
  organizationId: string;
  leadId: string;
  /** `Lead.awaitingSince` quando a espera começou: se mudou, alguém já respondeu. */
  anchorAt: string;
  dueAt: string;
  /** Mensagem do cliente que abriu a espera; a IA responde a partir dela. */
  messageId: string;
}

export type AttendanceCheckEvent = AttendanceCheckEventData | HumanAbsentCheckEventData;

/** O que a checagem faz depois de travar a seção, cada parte num passo do Inngest. */
export interface AttendanceCheckEffects {
  fixedMessageKind?: FixedMessageKind;
  aiReply?: { anchorMessageId: string; trigger: AttendanceAiTrigger };
  ownerNoticeNumber?: number;
  noticeWaitingSince?: string;
}

const MINUTE_MS = 60_000;

interface AttendanceContext {
  organizationId: string;
  trackingId: string;
  conversationId: string;
  statusFlow: AttendanceStatusFlow;
  isActive: boolean;
  isAiConnected: boolean;
  assistantName: string;
  settings: AttendanceSettings;
}

async function loadAttendanceContext(leadId: string): Promise<AttendanceContext | null> {
  if (!isAttendanceStateConfigured()) return null;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      statusFlow: true,
      isActive: true,
      trackingId: true,
      conversation: { select: { id: true, channel: true } },
      tracking: {
        select: {
          organizationId: true,
          globalAiActive: true,
          aiSettings: { select: { capabilities: true, assistantName: true } },
        },
      },
    },
  });
  // Só WhatsApp: a mensagem fixa e a IA do atendimento saem pelo número do funil.
  if (!lead?.conversation || lead.conversation.channel !== "WHATSAPP") return null;
  if (!isAttendanceStateEnabled(lead.tracking.organizationId)) return null;
  return {
    organizationId: lead.tracking.organizationId,
    trackingId: lead.trackingId,
    conversationId: lead.conversation.id,
    statusFlow: lead.statusFlow as AttendanceStatusFlow,
    isActive: lead.isActive,
    isAiConnected: lead.tracking.globalAiActive && Boolean(lead.tracking.aiSettings),
    assistantName: lead.tracking.aiSettings?.assistantName ?? "Atendimento",
    settings: parseAiCapabilities(lead.tracking.aiSettings?.capabilities).attendance,
  };
}

/** Único ponto que troca o estado: grava o `statusFlow` e, por último, deixa só a etiqueta do estado atual. */
export async function setStatusFlow(params: {
  organizationId: string;
  leadId: string;
  from: AttendanceStatusFlow;
  to: AttendanceStatusFlow;
}): Promise<void> {
  // Sem troca de estado a etiqueta já está certa: conferir a cada mensagem custava 4 idas ao banco.
  if (params.from === params.to) return;
  await prisma.lead.update({ where: { id: params.leadId }, data: { statusFlow: params.to } });
  // Etiqueta é espelho: se falhar (fluxo "Lead com Tag" com erro), o estado e a resposta ao cliente seguem.
  await mirrorStatusFlowTags({ organizationId: params.organizationId, leadId: params.leadId, statusFlow: params.to }).catch(
    (error: unknown) => console.warn("[attendance] etiqueta do estado falhou", error),
  );
}

/** O `id` do evento faz o Inngest ignorar o mesmo agendamento repetido (retry ou mensagens em sequência). */
async function scheduleCheck(data: AttendanceCheckEventData): Promise<void> {
  const eventId = [
    "attendance",
    data.sectionId,
    data.stage,
    data.anchorAt,
    data.noticeNumber ?? 0,
    data.isHandoffWait ? "handoff" : "wait",
    data.isComplaint ? "complaint" : "timer",
  ].join(":");
  await inngest.send({ id: eventId, name: ATTENDANCE_CHECK_EVENT, data });
}

function minutesFrom(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * MINUTE_MS).toISOString();
}

/** Primeira reclamação da demora nesta espera: −10 no Score. Devolve se foi a primeira. */
async function recordDelayComplaint(input: {
  leadId: string;
  sectionId: string;
  state: SectionState;
  messageText: string | null;
  at: Date;
}): Promise<boolean> {
  if (input.state.complaintAt || !looksLikeDelayComplaint(input.messageText)) return false;
  const isFirstComplaint = await patchSectionIf(
    input.sectionId,
    { complaintAt: input.at.toISOString() },
    { complaintAt: null },
  );
  if (isFirstComplaint) {
    await recordAttendanceScore({ leadId: input.leadId, reason: "client_complained", sectionId: input.sectionId });
  }
  return isFirstComplaint;
}

async function dispatchAiReply(params: {
  context: AttendanceContext;
  leadId: string;
  sectionId: string;
  anchorMessageId: string;
  trigger: AttendanceAiTrigger;
}): Promise<void> {
  await inngest.send({
    id: ["attendance-ai", params.sectionId, params.trigger, params.anchorMessageId].join(":"),
    name: AI_MESSAGE_EVENT,
    data: {
      trackingId: params.context.trackingId,
      leadId: params.leadId,
      conversationId: params.context.conversationId,
      messageId: params.anchorMessageId,
      organizationId: params.context.organizationId,
      trigger: params.trigger,
    },
  });
}

/** Mensagem do cliente (inbound). Roda antes de a IA ser acionada, para ela já ver o estado certo. */
export async function applyClientMessageAttendance(params: {
  leadId: string;
  messageId: string;
  messageText: string | null;
  at: Date;
  /**
   * A mensagem abriu a espera (`Lead.awaitingSince` estava vazio). As seguintes da mesma espera não mudam o
   * estado nem os prazos: só a reclamação da demora mexe em algo, então o resto sai sem consultar o banco.
   */
  isFirstOfWait?: boolean;
}): Promise<void> {
  if (params.isFirstOfWait === false && !looksLikeDelayComplaint(params.messageText)) return;
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;

  const atIso = params.at.toISOString();
  const { section } = await ensureOpenSection(params.leadId, "client_message", params.at, (stateBefore) => ({
    awaitingMessageId: stateBefore.awaitingMessageId && stateBefore.awaitingSince ? stateBefore.awaitingMessageId : params.messageId,
    awaitingSince: stateBefore.awaitingSince ?? atIso,
  }));
  const { state } = section;
  const isFirstUnanswered = !state.awaitingSince;
  const awaitingSince = state.awaitingSince ?? atIso;

  const isWaitingHandoff = isHandoffWaiting(state);
  const nextStatus: AttendanceStatusFlow =
    !isWaitingHandoff && hasCompanyTalked(state, context.settings) ? "ACTIVE" : "WAITING";

  // Agenda antes das etiquetas: falha em etiqueta não pode deixar o cliente sem resposta. Se a IA responde agora
  // é decidido no gatilho dela (`isAiHeldByAttendance`), a partir deste mesmo estado.
  if (context.isAiConnected) {
    const { settings } = context;
    const checkBase = { organizationId: context.organizationId, leadId: params.leadId, sectionId: section.id };

    if (isWaitingHandoff) {
      // Esperando consultor: a mensagem de "assim que um consultor desocupar" sai uma vez, na hora.
      if (!state.holdingSentAt) {
        await scheduleCheck({ ...checkBase, stage: "holding", anchorAt: awaitingSince, dueAt: atIso, isHandoffWait: true });
      }
    } else if (nextStatus === "WAITING") {
      const isAiFirst = settings.firstResponder === "AI" || hasAiTakenOver(state);
      if (!isAiFirst) {
        await scheduleTeamFirstWait({ context, state, sectionId: section.id, params, awaitingSince, isFirstUnanswered });
      } else if (settings.firstResponder === "TEAM") {
        // A IA já segura o cliente, mas a equipe ainda não respondeu: a reclamação da demora pesa no Score.
        await recordDelayComplaint({ leadId: params.leadId, sectionId: section.id, state, messageText: params.messageText, at: params.at });
      }
    }
    // Em atendimento com o atendente sumido, quem traz a IA de volta é o `human_absent` (todas as empresas).
  }

  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: nextStatus });
}

/** Equipe primeiro: reclamação durante a espera faz a IA entrar na hora; senão, mensagem fixa no prazo. */
async function scheduleTeamFirstWait(input: {
  context: AttendanceContext;
  state: SectionState;
  sectionId: string;
  params: { leadId: string; messageText: string | null; at: Date };
  awaitingSince: string;
  isFirstUnanswered: boolean;
}): Promise<void> {
  const { context, state, sectionId, params, awaitingSince } = input;
  const checkBase = { organizationId: context.organizationId, leadId: params.leadId, sectionId };
  const waitedMinutes = (params.at.getTime() - new Date(awaitingSince).getTime()) / MINUTE_MS;
  const isWaitingLongEnough = Boolean(state.holdingSentAt) || waitedMinutes >= context.settings.holdingMinutes;

  if (isWaitingLongEnough && looksLikeDelayComplaint(params.messageText)) {
    const isFirstComplaint = await recordDelayComplaint({ leadId: params.leadId, sectionId, state, messageText: params.messageText, at: params.at });
    if (isFirstComplaint) {
      await scheduleCheck({
        ...checkBase,
        stage: "ai_step_in",
        anchorAt: awaitingSince,
        dueAt: params.at.toISOString(),
        isComplaint: true,
      });
    }
    return;
  }
  if (input.isFirstUnanswered && !state.holdingSentAt) {
    await scheduleCheck({
      ...checkBase,
      stage: "holding",
      anchorAt: awaitingSince,
      dueAt: minutesFrom(new Date(awaitingSince), context.settings.holdingMinutes),
    });
  }
}

/**
 * Mensagem de um atendente (chat da plataforma ou celular). A IA fica calada enquanto ele conversa. Se o
 * cliente já tinha escrito nesta seção, é troca de verdade: "Em atendimento".
 */
export async function applyHumanReplyAttendance(params: { leadId: string; userId: string | null; at: Date }): Promise<void> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;

  const { section } = await ensureOpenSection(params.leadId, "company_reopened", params.at);
  const { awaitingSince, openReason, noticeAnchorAt } = section.state;
  // Pontua quem atende cliente que esperava atendimento ("Aguard."), não cada resposta de uma conversa em curso.
  // Com a IA segurando o cliente, a mensagem dele já foi respondida: a espera pela equipe vem do aviso ao dono.
  const waitingSince = awaitingSince ?? noticeAnchorAt ?? null;
  const wasClientWaiting = Boolean(waitingSince) && context.statusFlow === "WAITING";
  if (wasClientWaiting && waitingSince) {
    await recordAttendanceScore({
      leadId: params.leadId,
      reason: "human_answered_waiting_client",
      sectionId: section.id,
      actorId: params.userId,
    });
    const waitedMinutes = (params.at.getTime() - new Date(waitingSince).getTime()) / MINUTE_MS;
    if (waitedMinutes <= context.settings.holdingMinutes) {
      await recordAttendanceScore({ leadId: params.leadId, reason: "replied_in_time", sectionId: section.id, actorId: params.userId });
    }
  }
  await patchSection(section.id, {
    lastHumanAt: params.at.toISOString(),
    lastActivityAt: params.at.toISOString(),
    awaitingMessageId: null,
    awaitingSince: null,
    holdingSentAt: null,
    aiStepInAt: null,
    humanRequestedAt: null,
    ownerNoticeCount: 0,
    noticeAnchorAt: null,
    complaintAt: null,
  });
  const hasClientSpoken = openReason === "client_message" || Boolean(awaitingSince);
  if (hasClientSpoken) {
    await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "ACTIVE" });
  }
}

/** A IA respondeu ao cliente: conta como fala da empresa e a mensagem dele deixa de estar esperando. */
export async function markAiReplied(params: { leadId: string; at: Date }): Promise<void> {
  if (!isAttendanceStateConfigured()) return;
  const section = await findOpenSection(params.leadId);
  if (!section) return;
  const atIso = params.at.toISOString();
  await patchSection(section.id, { lastAiReplyAt: atIso, lastActivityAt: atIso, awaitingMessageId: null, awaitingSince: null });
}

/**
 * O cliente pediu humano ou a IA transferiu (spec 0113, RF-11). Com `shouldAiReturn`, a IA volta sozinha
 * depois do tempo do funil; sem (catálogo, saldo, limite de respostas), espera o consultor.
 */
export async function applyHandoffAttendance(params: { leadId: string; at: Date; shouldAiReturn?: boolean }): Promise<boolean> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return false;

  const { section } = await ensureOpenSection(params.leadId, "client_message", params.at);
  const atIso = params.at.toISOString();
  await patchSection(section.id, {
    humanRequestedAt: atIso,
    aiStepInAt: null,
    holdingSentAt: null,
    complaintAt: null,
    ownerNoticeCount: 0,
    noticeAnchorAt: null,
  });

  // A IA já se despede com as próprias palavras; a mensagem de espera sai se o cliente escrever (RF-11).
  if (context.isAiConnected && (params.shouldAiReturn ?? true)) {
    await scheduleCheck({
      organizationId: context.organizationId,
      leadId: params.leadId,
      sectionId: section.id,
      stage: "handoff_resume",
      anchorAt: atIso,
      dueAt: minutesFrom(params.at, context.settings.inServiceAiMinutes),
    });
  }
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "WAITING" });
  await dispatchAiFinishedWorkflows(context.trackingId, params.leadId);
  return true;
}

/** Atendimento concluído ("Finalizar", pagamento confirmado ou "Sim" no agendamento): fecha a seção. */
export async function applyFinishedAttendance(params: { leadId: string; outcome: SectionOutcome }): Promise<boolean> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return false;
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "FINISHED" });
  const section = await findOpenSection(params.leadId);
  if (section) await closeSection(section.id, params.outcome);
  return true;
}

/** Atendente conversando agora (seção aberta, sem a IA assumir depois). `null` quando a empresa não está no modelo. */
export async function isHumanAttendingNow(leadId: string): Promise<boolean | null> {
  const context = await loadAttendanceContext(leadId);
  if (!context) return null;
  const section = await findOpenSection(leadId);
  return section ? isHumanInConversation(section.state) : false;
}

/** Gatilho da IA, nas empresas no estado de atendimento: a seção aberta segura a IA agora? Roda no Inngest. */
export async function isAiHeldByAttendance(leadId: string): Promise<boolean> {
  const context = await loadAttendanceContext(leadId);
  if (!context) return false;
  const section = await findOpenSection(leadId);
  return section ? isAiHeldBySection(section.state, context.settings) : false;
}

/**
 * O cliente abriu uma espera com a IA calada por resposta humana recente: agenda UMA checagem para o fim do
 * prazo, contado da mensagem do cliente: o atendente teve esse tempo para responder. O id junta lead e início da espera, então mensagens seguidas não agendam de novo.
 */
export async function scheduleHumanAbsentCheck(params: {
  organizationId: string;
  leadId: string;
  trackingId: string;
  awaitingSince: Date;
  lastHumanReplyAt: Date | null;
  messageId: string;
}): Promise<void> {
  const aiSettings = await prisma.aiSettings.findUnique({ where: { trackingId: params.trackingId }, select: { capabilities: true } });
  const { inServiceAiMinutes } = parseAiCapabilities(aiSettings?.capabilities).attendance;
  // A IA só está calada se a resposta humana cabe no prazo deste funil; fora dele ela já responde sozinha.
  if (!isHumanReplyRecent(params.lastHumanReplyAt, params.awaitingSince, inServiceAiMinutes)) return;
  const anchorAt = params.awaitingSince.toISOString();
  const data: HumanAbsentCheckEventData = {
    stage: "human_absent",
    organizationId: params.organizationId,
    leadId: params.leadId,
    anchorAt,
    dueAt: minutesFrom(params.awaitingSince, inServiceAiMinutes),
    messageId: params.messageId,
  };
  await inngest.send({ id: ["attendance", "human-absent", params.leadId, anchorAt].join(":"), name: ATTENDANCE_CHECK_EVENT, data });
}

/** O atendente sumiu? Se ninguém respondeu desde o início da espera, a IA continua a conversa. */
export async function runHumanAbsentCheck(data: HumanAbsentCheckEventData): Promise<{ action: string }> {
  const lead = await prisma.lead.findUnique({
    where: { id: data.leadId },
    select: {
      awaitingSince: true,
      lastHumanReplyAt: true,
      trackingId: true,
      conversation: { select: { id: true } },
      tracking: { select: { organizationId: true, globalAiActive: true } },
    },
  });
  if (!lead?.conversation || !lead.tracking.globalAiActive) return { action: "disabled" };
  if (lead.awaitingSince?.toISOString() !== data.anchorAt) return { action: "stale" };
  if (lead.lastHumanReplyAt && lead.lastHumanReplyAt.toISOString() >= data.anchorAt) return { action: "human_answered" };
  await inngest.send({
    id: ["attendance-ai", "human-absent", data.leadId, data.anchorAt].join(":"),
    name: AI_MESSAGE_EVENT,
    data: {
      trackingId: lead.trackingId,
      leadId: data.leadId,
      conversationId: lead.conversation.id,
      messageId: data.messageId,
      organizationId: lead.tracking.organizationId,
      trigger: "attendance-in-service" satisfies AttendanceAiTrigger,
    },
  });
  return { action: "human_absent_ai" };
}

/** O próximo passo é da IA (pedido do catálogo): ela responde mesmo que um atendente tenha falado antes. */
export async function handOverToAi(params: { leadId: string }): Promise<void> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;
  const now = new Date();
  const { section } = await ensureOpenSection(params.leadId, "client_message", now);
  await patchSection(section.id, { aiStepInAt: now.toISOString() });
}

/**
 * A empresa abriu a conversa (campanha, "iniciar conversa"). O estado não muda: quem espera é a empresa, e
 * marcar "Aguard. atendimento" levaria a campanha inteira para a fila do Rodízio e para os fluxos dessa
 * etiqueta. Devolve se a empresa está no modelo novo, para quem chama não aplicar a regra antiga.
 */
export async function applyCompanyOpenedConversation(params: { leadId: string }): Promise<boolean> {
  return Boolean(await loadAttendanceContext(params.leadId));
}

/** Gatilho "IA finalizou" volta a disparar, agora na transferência para humano. */
async function dispatchAiFinishedWorkflows(trackingId: string, leadId: string): Promise<void> {
  const workflows = await prisma.workflow.findMany({
    where: { trackingId, isActive: true, nodes: { some: { type: "AI_FINISHED" } } },
    select: { id: true },
  });
  if (workflows.length > 0) {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, name: true, email: true, phone: true, statusId: true, trackingId: true, responsibleId: true, isActive: true },
    });
    if (lead) {
      const leadMessage = await getLastLeadMessage(lead.id);
      await Promise.all(workflows.map((workflow) => dispatchAiFinished({ workflowId: workflow.id, lead, leadMessage })));
    }
  }
  await broadcastAgentWorkflowEvent({ event: "ai-finished", leadId, trackingId });
}

/**
 * Checagem agendada, primeira parte: confere se a situação que a agendou continua igual e trava a seção.
 * O próximo estágio é agendado antes da trava: se algo falhar depois, o retry não perde a cadeia.
 */
export async function claimAttendanceCheck(data: AttendanceCheckEventData): Promise<{ action: string; effects?: AttendanceCheckEffects }> {
  const context = await loadAttendanceContext(data.leadId);
  if (!context?.isAiConnected) return { action: "disabled" };
  const section = await findOpenSection(data.leadId);
  if (!section || section.id !== data.sectionId) return { action: "section_changed" };
  const { state } = section;
  const now = new Date();
  const nowIso = now.toISOString();
  if (state.lastHumanAt && state.lastHumanAt >= data.anchorAt) return { action: "human_answered" };
  const { settings } = context;

  switch (data.stage) {
    case "holding": {
      if (state.awaitingSince !== data.anchorAt || state.holdingSentAt || state.aiStepInAt || state.complaintAt) {
        return { action: "stale" };
      }
      // Na espera da transferência, quem traz a IA de volta é o `handoff_resume` já agendado.
      if (!data.isHandoffWait) {
        await scheduleCheck({ ...data, stage: "ai_step_in", dueAt: minutesFrom(now, settings.aiStepInMinutes) });
      }
      const isClaimed = await patchSectionIf(section.id, { holdingSentAt: nowIso }, { holdingSentAt: null, awaitingSince: data.anchorAt });
      if (!isClaimed) return { action: "stale" };
      return { action: "holding", effects: { fixedMessageKind: data.isHandoffWait ? "attendance_handoff" : "attendance_holding" } };
    }
    case "ai_step_in": {
      if (state.awaitingSince !== data.anchorAt || state.aiStepInAt || !state.awaitingMessageId) return { action: "stale" };
      await scheduleCheck({ ...data, stage: "owner_notice", noticeNumber: 2, dueAt: minutesFrom(now, settings.ownerNoticeMinutes) });
      const isClaimed = await patchSectionIf(
        section.id,
        { aiStepInAt: nowIso, ownerNoticeCount: 1, noticeAnchorAt: data.anchorAt },
        { aiStepInAt: null, awaitingSince: data.anchorAt },
      );
      if (!isClaimed) return { action: "stale" };
      return {
        action: "ai_step_in",
        effects: {
          aiReply: { anchorMessageId: state.awaitingMessageId, trigger: "attendance-step-in" },
          ownerNoticeNumber: 1,
          noticeWaitingSince: data.anchorAt,
        },
      };
    }
    case "handoff_resume": {
      if (state.humanRequestedAt !== data.anchorAt || state.aiStepInAt) return { action: "stale" };
      await scheduleCheck({ ...data, stage: "owner_notice", noticeNumber: 2, dueAt: minutesFrom(now, settings.ownerNoticeMinutes) });
      const isClaimed = await patchSectionIf(
        section.id,
        { aiStepInAt: nowIso, ownerNoticeCount: 1, noticeAnchorAt: data.anchorAt },
        { humanRequestedAt: data.anchorAt, aiStepInAt: null },
      );
      if (!isClaimed) return { action: "stale" };
      // Só responde se o cliente escreveu depois do pedido; senão a IA volta calada e responde à próxima mensagem.
      const hasClientWrittenSince = Boolean(state.awaitingMessageId && state.awaitingSince && state.awaitingSince >= data.anchorAt);
      return {
        action: "handoff_resume",
        effects: {
          ...(hasClientWrittenSince && state.awaitingMessageId
            ? { aiReply: { anchorMessageId: state.awaitingMessageId, trigger: "attendance-handoff-resume" as const } }
            : {}),
          ownerNoticeNumber: 1,
          noticeWaitingSince: data.anchorAt,
        },
      };
    }
    case "owner_notice": {
      const noticeNumber = data.noticeNumber ?? 2;
      if (state.noticeAnchorAt !== data.anchorAt || (state.ownerNoticeCount ?? 0) >= noticeNumber) return { action: "stale" };
      // Até 3 avisos por WhatsApp; o 4º é só sino/push, e para aí.
      if (noticeNumber <= MAX_OWNER_WHATSAPP_NOTICES) {
        await scheduleCheck({ ...data, noticeNumber: noticeNumber + 1, dueAt: minutesFrom(now, settings.ownerNoticeMinutes) });
      }
      const isClaimed = await patchSectionIf(
        section.id,
        { ownerNoticeCount: noticeNumber },
        { noticeAnchorAt: data.anchorAt, ownerNoticeCount: String(noticeNumber - 1) },
      );
      if (!isClaimed) return { action: "stale" };
      return { action: `owner_notice_${noticeNumber}`, effects: { ownerNoticeNumber: noticeNumber, noticeWaitingSince: data.anchorAt } };
    }
  }
}

/** Segunda parte: a mensagem fixa, num passo próprio para um retry não mandar duas. */
export async function sendCheckFixedMessage(data: AttendanceCheckEventData, kind: FixedMessageKind): Promise<{ action: string }> {
  const context = await loadAttendanceContext(data.leadId);
  if (!context) return { action: "disabled" };
  const sent = await sendAttendanceFixedMessage({
    organizationId: context.organizationId,
    trackingId: context.trackingId,
    leadId: data.leadId,
    conversationId: context.conversationId,
    text: kind === "attendance_handoff" ? context.settings.handoffText : context.settings.holdingText,
    kind,
    senderName: context.assistantName,
  });
  await recordAttendanceScore({
    leadId: data.leadId,
    reason: sent.isSent ? "replied_in_time" : "unanswered_beyond_time",
    sectionId: data.sectionId,
  });
  return { action: sent.isSent ? "holding_sent" : `holding_failed:${sent.reason}` };
}

/** Terceira parte: liga a IA, aciona a resposta e avisa o dono. Repetível sem efeito dobrado na IA. */
export async function applyCheckEffects(data: AttendanceCheckEventData, effects: AttendanceCheckEffects): Promise<{ action: string }> {
  const context = await loadAttendanceContext(data.leadId);
  if (!context) return { action: "disabled" };
  if (effects.aiReply) {
    await dispatchAiReply({
      context,
      leadId: data.leadId,
      sectionId: data.sectionId,
      anchorMessageId: effects.aiReply.anchorMessageId,
      trigger: effects.aiReply.trigger,
    });
  }
  if (effects.ownerNoticeNumber) {
    const waitingSince = effects.noticeWaitingSince ?? data.anchorAt;
    await notifyUnattendedLead({
      organizationId: context.organizationId,
      leadId: data.leadId,
      conversationId: context.conversationId,
      noticeNumber: effects.ownerNoticeNumber,
      waitingMinutes: Math.max(1, Math.round((Date.now() - new Date(waitingSince).getTime()) / MINUTE_MS)),
    });
  }
  return { action: "applied" };
}

/** Entrada por canais que não passam pelo pipeline do chat (Instagram, Facebook): etiquetas e, se for o caso, estado. */
export async function applyInboundAttendanceOutsidePipeline(params: {
  organizationId: string;
  leadId: string;
  channel: InboundChannel;
  wasAwaitingReply: boolean;
  messageId: string;
  messageText: string | null;
}): Promise<void> {
  const isAttendanceStateManaged = isAttendanceManagedChannel(params.organizationId, params.channel);
  await applyInboundAutoTags({
    organizationId: params.organizationId,
    leadId: params.leadId,
    channel: params.channel,
    wasAwaitingReply: params.wasAwaitingReply,
    isAttendanceStateManaged,
  });
  if (isAttendanceStateManaged) {
    await applyClientMessageAttendance({
      leadId: params.leadId,
      messageId: params.messageId,
      messageText: params.messageText,
      at: new Date(),
    });
  }
}
