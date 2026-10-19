import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { broadcastAgentWorkflowEvent, dispatchAiFinished } from "@/inngest/utils";
import { getLastLeadMessage } from "@/features/tracking-executions/lib/lead-message";
import { parseAiCapabilities, type AttendanceSettings } from "@/features/tracking-chat-ai/lib/capabilities";
import { isAttendanceStateEnabled } from "./flag";
import { mirrorStatusFlowTags, type AttendanceStatusFlow } from "./tags";
import { ensureOpenSection, findOpenSection, patchSection, closeSection, type AttendanceSection, type SectionOutcome } from "./section";
import { recordAttendanceScore } from "./score";
import { looksLikeDelayComplaint } from "./complaint";
import { sendAttendanceFixedMessage, type FixedMessageKind } from "./fixed-message";
import { notifyUnattendedLead, MAX_OWNER_WHATSAPP_NOTICES } from "./owner-notice";
import { applyInboundAutoTags, type InboundChannel } from "../auto-tags";

// Estado de atendimento (spec 0113). O estado é o `Lead.statusFlow`; `Lead.isActive` passa a dizer só "a IA
// pode responder agora". Cada espera vira UM evento atrasado (`attendance/check`); quem acorda confere se
// ainda vale e não faz nada se alguém já respondeu.

export const ATTENDANCE_CHECK_EVENT = "attendance/check";
export const AI_MESSAGE_EVENT = "chat/ai.whatsapp-message-received";

export type AttendanceCheckStage = "holding" | "ai_step_in" | "in_service_ai" | "handoff_resume" | "owner_notice";

export interface AttendanceCheckEventData {
  organizationId: string;
  leadId: string;
  sectionId: string;
  stage: AttendanceCheckStage;
  /** Momento que a checagem confere: o início da espera, a mensagem do cliente ou o pedido de humano. */
  anchorAt: string;
  dueAt: string;
  noticeNumber?: number;
  /** Na espera da transferência a mensagem fixa é a de "consultor", e a IA volta pelo `handoff_resume`. */
  isHandoffWait?: boolean;
}

const MINUTE_MS = 60_000;
const FIXED_MESSAGE_KINDS: string[] = ["attendance_holding", "attendance_handoff"];

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
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      statusFlow: true,
      isActive: true,
      trackingId: true,
      conversation: { select: { id: true } },
      tracking: {
        select: {
          organizationId: true,
          globalAiActive: true,
          aiSettings: { select: { capabilities: true, assistantName: true } },
        },
      },
    },
  });
  if (!lead?.conversation || !isAttendanceStateEnabled(lead.tracking.organizationId)) return null;
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

/** Único ponto que troca o estado: grava o `statusFlow` e deixa só a etiqueta do estado atual. */
export async function setStatusFlow(params: {
  organizationId: string;
  leadId: string;
  from: AttendanceStatusFlow;
  to: AttendanceStatusFlow;
}): Promise<void> {
  if (params.from !== params.to) {
    await prisma.lead.update({ where: { id: params.leadId }, data: { statusFlow: params.to } });
  }
  await mirrorStatusFlowTags({ organizationId: params.organizationId, leadId: params.leadId, statusFlow: params.to });
}

async function setAiAllowed(leadId: string, isAllowed: boolean, current: boolean): Promise<void> {
  if (isAllowed === current) return;
  await prisma.lead.update({ where: { id: leadId }, data: { isActive: isAllowed } });
}

async function scheduleCheck(data: AttendanceCheckEventData): Promise<void> {
  await inngest.send({ name: ATTENDANCE_CHECK_EVENT, data });
}

function minutesFrom(base: Date, minutes: number): string {
  return new Date(base.getTime() + minutes * MINUTE_MS).toISOString();
}

/** A IA assumiu nesta espera e nenhum humano falou depois. */
function hasAiTakenOver(section: AttendanceSection): boolean {
  const { aiStepInAt, lastHumanAt } = section.state;
  return Boolean(aiStepInAt && (!lastHumanAt || aiStepInAt > lastHumanAt));
}

/** Um atendente está na conversa: falou nesta seção e a IA não assumiu depois dele. */
function isHumanInConversation(section: AttendanceSection): boolean {
  return Boolean(section.state.lastHumanAt) && !hasAiTakenOver(section);
}

/** Troca de verdade: antes desta mensagem do cliente, a empresa falou de fato nesta seção (spec 0113, RF-9). */
async function didCompanyTalkBefore(conversationId: string, section: AttendanceSection, clientMessageAt: Date): Promise<boolean> {
  const previousCompanyMessage = await prisma.message.findFirst({
    where: {
      conversationId,
      fromMe: true,
      createdAt: { gte: new Date(section.state.openedAt), lt: clientMessageAt },
    },
    orderBy: { createdAt: "desc" },
    select: { metadata: true },
  });
  if (!previousCompanyMessage) return false;
  const metadata = (previousCompanyMessage.metadata ?? {}) as { kind?: unknown; internal?: unknown };
  return !metadata.internal && !FIXED_MESSAGE_KINDS.includes(String(metadata.kind ?? ""));
}

async function dispatchAiReply(params: {
  context: AttendanceContext;
  leadId: string;
  anchorMessageId: string;
  trigger: "attendance-step-in" | "attendance-in-service" | "attendance-handoff-resume";
}): Promise<void> {
  await inngest.send({
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
}): Promise<void> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;

  const section = await ensureOpenSection(params.leadId, "client_message", params.at);
  const isRealExchange = await didCompanyTalkBefore(context.conversationId, section, params.at);
  const nextStatus: AttendanceStatusFlow = context.statusFlow === "ACTIVE" || isRealExchange ? "ACTIVE" : "WAITING";
  const awaitingSince = section.state.awaitingSince ?? params.at.toISOString();
  await patchSection(section.id, { awaitingMessageId: params.messageId, awaitingSince });
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: nextStatus });

  if (!context.isAiConnected) return;
  const { settings } = context;
  const aiTookOver = hasAiTakenOver(section);

  // Em atendimento só cala a IA quando há humano na conversa; conversa só com a IA segue respondendo na hora.
  if (nextStatus === "ACTIVE") {
    const isHumanTalking = isHumanInConversation(section);
    await setAiAllowed(params.leadId, !isHumanTalking, context.isActive);
    if (isHumanTalking) {
      await scheduleCheck({
        organizationId: context.organizationId,
        leadId: params.leadId,
        sectionId: section.id,
        stage: "in_service_ai",
        anchorAt: params.at.toISOString(),
        dueAt: minutesFrom(params.at, settings.inServiceAiMinutes),
      });
    }
    return;
  }

  const isWaitingHandoff = Boolean(section.state.humanRequestedAt) && !aiTookOver;
  const isAiFirst = settings.firstResponder === "AI" || aiTookOver;
  await setAiAllowed(params.leadId, isAiFirst && !isWaitingHandoff, context.isActive);
  // Esperando consultor: a mensagem de "assim que um consultor desocupar" sai uma vez, na hora.
  if (isWaitingHandoff) {
    if (!section.state.holdingSentAt) {
      await scheduleCheck({
        organizationId: context.organizationId,
        leadId: params.leadId,
        sectionId: section.id,
        stage: "holding",
        anchorAt: awaitingSince,
        dueAt: params.at.toISOString(),
        isHandoffWait: true,
      });
    }
    return;
  }
  if (isAiFirst) return;

  // Equipe primeiro: reclamação durante a espera faz a IA entrar na hora; senão, mensagem fixa no prazo.
  const waitedMinutes = (params.at.getTime() - new Date(awaitingSince).getTime()) / MINUTE_MS;
  const isWaitingLongEnough = Boolean(section.state.holdingSentAt) || waitedMinutes >= settings.holdingMinutes;
  if (isWaitingLongEnough && !section.state.complaintAt && looksLikeDelayComplaint(params.messageText)) {
    await patchSection(section.id, { complaintAt: params.at.toISOString() });
    await recordAttendanceScore({ leadId: params.leadId, reason: "client_complained", sectionId: section.id });
    await scheduleCheck({
      organizationId: context.organizationId,
      leadId: params.leadId,
      sectionId: section.id,
      stage: "ai_step_in",
      anchorAt: awaitingSince,
      dueAt: params.at.toISOString(),
    });
    return;
  }
  if (!section.state.holdingSentAt && awaitingSince === params.at.toISOString()) {
    await scheduleCheck({
      organizationId: context.organizationId,
      leadId: params.leadId,
      sectionId: section.id,
      stage: "holding",
      anchorAt: awaitingSince,
      dueAt: minutesFrom(new Date(awaitingSince), settings.holdingMinutes),
    });
  }
}

/** Mensagem de um atendente (chat da plataforma ou celular). A IA fica calada enquanto ele conversa. */
export async function applyHumanReplyAttendance(params: { leadId: string; userId: string | null; at: Date }): Promise<void> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;

  const section =
    (await findOpenSection(params.leadId)) ?? (await ensureOpenSection(params.leadId, "company_reopened", params.at));
  const { awaitingSince } = section.state;
  if (awaitingSince) {
    await recordAttendanceScore({
      leadId: params.leadId,
      reason: "human_answered_waiting_client",
      sectionId: section.id,
      actorId: params.userId,
    });
    const waitedMinutes = (params.at.getTime() - new Date(awaitingSince).getTime()) / MINUTE_MS;
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
    complaintAt: null,
  });
  await setAiAllowed(params.leadId, false, context.isActive);
  // A empresa reabriu uma conversa finalizada: volta a esperar o cliente.
  if (context.statusFlow === "FINISHED" || context.statusFlow === "NEW") {
    await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "WAITING" });
  }
}

/** O cliente pediu humano ou a IA transferiu (spec 0113, RF-11). */
export async function applyHandoffAttendance(params: { leadId: string; at: Date }): Promise<boolean> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return false;

  const section = await ensureOpenSection(params.leadId, "client_message", params.at);
  await patchSection(section.id, {
    humanRequestedAt: params.at.toISOString(),
    aiStepInAt: null,
    holdingSentAt: null,
    ownerNoticeCount: 0,
  });
  await setAiAllowed(params.leadId, false, context.isActive);
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "WAITING" });

  // A IA já se despede com as próprias palavras; a mensagem de espera sai se o cliente escrever (RF-11).
  if (context.isAiConnected) {
    await scheduleCheck({
      organizationId: context.organizationId,
      leadId: params.leadId,
      sectionId: section.id,
      stage: "handoff_resume",
      anchorAt: params.at.toISOString(),
      dueAt: minutesFrom(params.at, context.settings.inServiceAiMinutes),
    });
  }
  await dispatchAiFinishedWorkflows(context.trackingId, params.leadId);
  return true;
}

/** Atendimento concluído ("Finalizar" ou "Sim" no agendamento): fecha a seção. */
export async function applyFinishedAttendance(params: { leadId: string; outcome: SectionOutcome }): Promise<void> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return;
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "FINISHED" });
  const section = await findOpenSection(params.leadId);
  if (section) await closeSection(section.id, params.outcome);
}

/** A empresa abriu a conversa (campanha, "iniciar conversa", recuperação): espera o cliente responder. */
export async function applyCompanyOpenedConversation(params: { leadId: string }): Promise<boolean> {
  const context = await loadAttendanceContext(params.leadId);
  if (!context) return false;
  await setStatusFlow({ organizationId: context.organizationId, leadId: params.leadId, from: context.statusFlow, to: "WAITING" });
  return true;
}

async function sendFixed(context: AttendanceContext, leadId: string, text: string, kind: FixedMessageKind) {
  return sendAttendanceFixedMessage({
    organizationId: context.organizationId,
    trackingId: context.trackingId,
    leadId,
    conversationId: context.conversationId,
    text,
    kind,
    senderName: context.assistantName,
  });
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

/** Checagem agendada: só age se a situação que a agendou continua igual. */
export async function runAttendanceCheck(data: AttendanceCheckEventData): Promise<{ action: string }> {
  const context = await loadAttendanceContext(data.leadId);
  if (!context?.isAiConnected) return { action: "disabled" };
  const section = await findOpenSection(data.leadId);
  if (!section || section.id !== data.sectionId) return { action: "section_changed" };
  const { state } = section;
  const now = new Date();
  const humanAnsweredSinceAnchor = Boolean(state.lastHumanAt && state.lastHumanAt >= data.anchorAt);
  if (humanAnsweredSinceAnchor) return { action: "human_answered" };

  switch (data.stage) {
    case "holding": {
      if (state.awaitingSince !== data.anchorAt || state.holdingSentAt) return { action: "stale" };
      const sent = data.isHandoffWait
        ? await sendFixed(context, data.leadId, context.settings.handoffText, "attendance_handoff")
        : await sendFixed(context, data.leadId, context.settings.holdingText, "attendance_holding");
      if (sent.isSent) {
        await patchSection(section.id, { holdingSentAt: now.toISOString() });
        await recordAttendanceScore({ leadId: data.leadId, reason: "replied_in_time", sectionId: section.id });
      } else {
        await recordAttendanceScore({ leadId: data.leadId, reason: "unanswered_beyond_time", sectionId: section.id });
      }
      // Na espera da transferência, quem traz a IA de volta é o `handoff_resume` já agendado.
      if (!data.isHandoffWait) {
        await scheduleCheck({ ...data, stage: "ai_step_in", dueAt: minutesFrom(now, context.settings.aiStepInMinutes) });
      }
      return { action: sent.isSent ? "holding_sent" : `holding_failed:${sent.reason}` };
    }
    case "ai_step_in": {
      if (state.awaitingSince !== data.anchorAt || state.aiStepInAt || !state.awaitingMessageId) return { action: "stale" };
      await patchSection(section.id, { aiStepInAt: now.toISOString(), ownerNoticeCount: 1 });
      await setAiAllowed(data.leadId, true, context.isActive);
      await dispatchAiReply({ context, leadId: data.leadId, anchorMessageId: state.awaitingMessageId, trigger: "attendance-step-in" });
      await notifyAndScheduleNext(context, data, state.awaitingSince ?? data.anchorAt, 1);
      return { action: "ai_stepped_in" };
    }
    case "in_service_ai": {
      if (context.statusFlow !== "ACTIVE" || !state.awaitingMessageId || state.awaitingSince === null) return { action: "stale" };
      if (state.aiStepInAt && state.aiStepInAt >= data.anchorAt) return { action: "stale" };
      await patchSection(section.id, { aiStepInAt: now.toISOString() });
      await setAiAllowed(data.leadId, true, context.isActive);
      await dispatchAiReply({ context, leadId: data.leadId, anchorMessageId: state.awaitingMessageId, trigger: "attendance-in-service" });
      return { action: "ai_continued" };
    }
    case "handoff_resume": {
      if (state.humanRequestedAt !== data.anchorAt || state.aiStepInAt) return { action: "stale" };
      await patchSection(section.id, { aiStepInAt: now.toISOString(), ownerNoticeCount: 1 });
      await setAiAllowed(data.leadId, true, context.isActive);
      if (state.awaitingMessageId) {
        await dispatchAiReply({ context, leadId: data.leadId, anchorMessageId: state.awaitingMessageId, trigger: "attendance-handoff-resume" });
      }
      await notifyAndScheduleNext(context, data, data.anchorAt, 1);
      return { action: "ai_resumed" };
    }
    case "owner_notice": {
      const noticeNumber = data.noticeNumber ?? 2;
      if ((state.ownerNoticeCount ?? 0) >= noticeNumber) return { action: "stale" };
      await patchSection(section.id, { ownerNoticeCount: noticeNumber });
      await notifyAndScheduleNext(context, data, data.anchorAt, noticeNumber);
      return { action: `owner_notice_${noticeNumber}` };
    }
  }
}

async function notifyAndScheduleNext(
  context: AttendanceContext,
  data: AttendanceCheckEventData,
  waitingSince: string,
  noticeNumber: number,
): Promise<void> {
  const now = new Date();
  await notifyUnattendedLead({
    organizationId: context.organizationId,
    leadId: data.leadId,
    conversationId: context.conversationId,
    noticeNumber,
    waitingMinutes: Math.max(1, Math.round((now.getTime() - new Date(waitingSince).getTime()) / MINUTE_MS)),
  });
  // Até 3 avisos por WhatsApp; o 4º é só sino/push, e para aí.
  if (noticeNumber <= MAX_OWNER_WHATSAPP_NOTICES) {
    await scheduleCheck({
      ...data,
      stage: "owner_notice",
      noticeNumber: noticeNumber + 1,
      dueAt: minutesFrom(now, context.settings.ownerNoticeMinutes),
    });
  }
}

/** Entrada por canais que não passam pelo pipeline do chat (Instagram, Facebook): etiquetas + estado. */
export async function applyInboundAttendanceOutsidePipeline(params: {
  organizationId: string;
  leadId: string;
  channel: InboundChannel;
  wasAwaitingReply: boolean;
  messageId: string;
  messageText: string | null;
}): Promise<void> {
  const isAttendanceStateManaged = isAttendanceStateEnabled(params.organizationId);
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
