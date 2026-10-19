import "server-only";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { pusherServer } from "@/lib/pusher";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import { createNotification } from "@/features/admin/lib/notification-service";
import { resolveOrgAdmins } from "@/features/alerts/lib/audience-resolver";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { isAttendanceStateEnabled } from "./flag";
import { addHistoryTag, removeHistoryTag, type HistoryTagReason } from "./tags";
import { findOpenSection } from "./section";
import { recordAttendanceScore } from "./score";
import { applyFinishedAttendance } from "./state";

// Agendamento no atendimento (spec 0113, RF-17 e RF-18): "Agendado" com histórico, eventos de cancelamento e
// remarcação na Jornada e, no horário, a conferência da equipe (Sim / Não / Cancelou). A conferência é um
// evento da Jornada lido pelo chat; nunca é mensagem e nunca sai ao cliente.

export const APPOINTMENT_WATCH_EVENT = "attendance/appointment.watch";
export const APPOINTMENT_RECHECK_MINUTES = 10;
export const MAX_APPOINTMENT_CHECK_ASKS = 3;

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = ["PENDING", "CONFIRMED"];
const MINUTE_MS = 60_000;

export type AppointmentChange = "scheduled" | "rescheduled" | "cancelled" | "deleted" | "done";
export type AppointmentCheckStatus = "pending" | "not_yet" | "attended" | "cancelled" | "unanswered";
export type AppointmentCheckAnswer = "attended" | "not_yet" | "cancelled";

export interface AppointmentWatchEventData {
  appointmentId: string;
  organizationId: string;
  stage: "start" | "recheck";
  /** Horário conferido ao acordar: remarcou, o evento antigo vê a data mudada e não age. */
  startsAt: string;
  endsAt: string;
  checkId?: string;
  dueAt?: string;
}

export interface AppointmentCheckState {
  appointmentId: string;
  startsAt: string;
  title: string | null;
  status: AppointmentCheckStatus;
  askCount: number;
  lastAskedAt: string;
  answeredBy?: string | null;
  answeredAt?: string;
}

export interface AppointmentSnapshot {
  id: string;
  leadId: string | null;
  title: string | null;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
  cancelledBy: string | null;
  userId: string | null;
  organizationId: string;
}

export async function loadAppointmentSnapshot(appointmentId: string): Promise<AppointmentSnapshot | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      leadId: true,
      title: true,
      startsAt: true,
      endsAt: true,
      status: true,
      cancelledBy: true,
      userId: true,
      agenda: { select: { organizationId: true } },
    },
  });
  if (!appointment) return null;
  const { agenda, ...fields } = appointment;
  return { ...fields, organizationId: agenda.organizationId };
}

function isActiveAppointment(appointment: AppointmentSnapshot): boolean {
  return ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status);
}

/** "Agendado" sai só quando o lead não tem outro agendamento ainda por vir. */
async function releaseScheduledTag(params: {
  organizationId: string;
  leadId: string;
  appointmentId: string;
  reason: HistoryTagReason;
}): Promise<void> {
  const otherUpcoming = await prisma.appointment.findFirst({
    where: {
      leadId: params.leadId,
      id: { not: params.appointmentId },
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      endsAt: { gt: new Date() },
    },
    select: { id: true },
  });
  if (otherUpcoming) return;
  await removeHistoryTag({ ...params, key: "scheduled" });
}

async function findChecks(appointmentId: string) {
  const events = await prisma.leadJourneyEvent.findMany({
    where: { kind: "appointment_check", metadata: { path: ["appointmentId"], equals: appointmentId } },
    orderBy: { occurredAt: "desc" },
    select: { id: true, leadId: true, metadata: true },
  });
  return events.map((event) => ({ id: event.id, leadId: event.leadId, state: event.metadata as unknown as AppointmentCheckState }));
}

/** Troca o estado da conferência só se ele ainda é um dos esperados (dois cliques não valem duas vezes). */
async function transitionCheck(
  checkId: string,
  fromStatuses: AppointmentCheckStatus[],
  patch: Partial<AppointmentCheckState>,
): Promise<boolean> {
  const updatedRows = await prisma.$executeRaw`
    UPDATE lead_journey_events
    SET metadata = metadata || ${JSON.stringify(patch)}::jsonb
    WHERE id = ${checkId} AND kind = 'appointment_check' AND metadata->>'status' = ANY(${fromStatuses})
  `;
  return updatedRows > 0;
}

async function refreshLeadInChat(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { trackingId: true } });
  if (!lead) return;
  await pusherServer.trigger(lead.trackingId, "lead:updated", { leadId }).catch(() => undefined);
}

/**
 * Registra a mudança de um agendamento. Chamar depois de gravar o agendamento, fora de transação. Para
 * exclusão, passe o `snapshot` lido antes de apagar.
 */
export async function recordAppointmentChange(params: {
  appointmentId: string;
  change: AppointmentChange;
  actorId?: string | null;
  previousStartsAt?: Date | null;
  snapshot?: AppointmentSnapshot | null;
}): Promise<void> {
  const appointment = params.snapshot ?? (await loadAppointmentSnapshot(params.appointmentId));
  if (!appointment?.leadId) return;
  const leadId = appointment.leadId;
  const actorId = params.actorId ?? null;

  if (params.change === "cancelled" || params.change === "deleted") {
    await trackLeadEvent({
      leadId,
      kind: "appointment_cancelled",
      actorId,
      metadata: {
        appointmentId: appointment.id,
        title: appointment.title,
        startsAt: appointment.startsAt.toISOString(),
        cancelledBy: appointment.cancelledBy,
        isDeleted: params.change === "deleted",
      },
    });
  }
  if (params.change === "rescheduled") {
    await trackLeadEvent({
      leadId,
      kind: "appointment_rescheduled",
      actorId,
      metadata: {
        appointmentId: appointment.id,
        previousStartsAt: params.previousStartsAt?.toISOString() ?? null,
        startsAt: appointment.startsAt.toISOString(),
      },
    });
  }

  if (!isAttendanceStateEnabled(appointment.organizationId)) return;
  const organizationId = appointment.organizationId;

  if (params.change === "scheduled" || params.change === "rescheduled") {
    if (!isActiveAppointment(appointment) || appointment.endsAt.getTime() <= Date.now()) return;
    await addHistoryTag({
      organizationId,
      leadId,
      key: "scheduled",
      reason: params.change === "scheduled" ? "booked" : "rescheduled",
      appointmentId: appointment.id,
    });
    // Voltou a agendar depois de cancelar: a recuperação deu certo.
    await removeHistoryTag({ organizationId, leadId, key: "cancelled", reason: "booked", appointmentId: appointment.id });
    const watch: AppointmentWatchEventData = {
      appointmentId: appointment.id,
      organizationId,
      stage: "start",
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
    };
    await inngest.send({ name: APPOINTMENT_WATCH_EVENT, data: watch });
    return;
  }

  const isDone = params.change === "done";
  await releaseScheduledTag({ organizationId, leadId, appointmentId: appointment.id, reason: isDone ? "finished" : "cancelled" });
  for (const check of await findChecks(appointment.id)) {
    await transitionCheck(check.id, ["pending", "not_yet"], {
      status: isDone ? "attended" : "cancelled",
      answeredBy: actorId,
      answeredAt: new Date().toISOString(),
    });
  }
  // Só quando o cliente cancelou: cancelamento da equipe (engano, duplicado) não dispara recuperação.
  if (params.change === "cancelled" && appointment.cancelledBy === "CLIENT") {
    await addHistoryTag({ organizationId, leadId, key: "cancelled", reason: "cancelled", appointmentId: appointment.id });
  }
  await refreshLeadInChat(leadId);
}

function isSameSchedule(appointment: AppointmentSnapshot, data: AppointmentWatchEventData): boolean {
  return appointment.startsAt.toISOString() === data.startsAt && appointment.endsAt.toISOString() === data.endsAt;
}

async function askTeam(params: { appointment: AppointmentSnapshot; leadId: string; askNumber: number }): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: params.leadId },
    select: { name: true, responsibleId: true, conversation: { select: { id: true } } },
  });
  if (!lead) return;
  const responsibleId = params.appointment.userId ?? lead.responsibleId;
  const recipientIds = responsibleId ? [responsibleId] : await resolveOrgAdmins(params.appointment.organizationId);
  const time = params.appointment.startsAt.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  const body =
    params.askNumber === 1
      ? `${lead.name} tinha horário às ${time}. O cliente veio?`
      : `${lead.name} ainda não chegou para o horário das ${time}? Responda no chat.`;
  for (const userId of recipientIds) {
    await createNotification({
      userId,
      organizationId: params.appointment.organizationId,
      type: "APPOINTMENT_REMINDER",
      title: "Confira o agendamento",
      body,
      appKey: "tracking",
      actionUrl: lead.conversation ? `/tracking-chat/${lead.conversation.id}` : undefined,
      severity: "info",
    }).catch((error: unknown) => console.warn("[attendance] aviso da conferência falhou", error));
  }
  await refreshLeadInChat(params.leadId);
}

/** No horário do agendamento: abre a conferência da equipe. */
export async function openAppointmentCheck(data: AppointmentWatchEventData): Promise<{ action: string }> {
  const appointment = await loadAppointmentSnapshot(data.appointmentId);
  if (!appointment?.leadId) return { action: "no_lead" };
  if (!isSameSchedule(appointment, data)) return { action: "rescheduled" };
  if (!isActiveAppointment(appointment)) return { action: "not_active" };
  if (!isAttendanceStateEnabled(appointment.organizationId)) return { action: "disabled" };

  const alreadyOpened = (await findChecks(appointment.id)).some((check) => check.state.startsAt === data.startsAt);
  if (alreadyOpened) return { action: "already_open" };

  const now = new Date();
  const state: AppointmentCheckState = {
    appointmentId: appointment.id,
    startsAt: data.startsAt,
    title: appointment.title,
    status: "pending",
    askCount: 1,
    lastAskedAt: now.toISOString(),
  };
  await trackLeadEvent({ leadId: appointment.leadId, kind: "appointment_check", occurredAt: now, metadata: { ...state } });
  await askTeam({ appointment, leadId: appointment.leadId, askNumber: 1 });
  return { action: "asked" };
}

/** Depois do horário: "Agendado" sai se o lead não tem outro agendamento por vir. */
export async function expireScheduledTag(data: AppointmentWatchEventData): Promise<{ action: string }> {
  const appointment = await loadAppointmentSnapshot(data.appointmentId);
  if (!appointment?.leadId) return { action: "no_lead" };
  if (!isSameSchedule(appointment, data)) return { action: "rescheduled" };
  if (!isAttendanceStateEnabled(appointment.organizationId)) return { action: "disabled" };
  await releaseScheduledTag({
    organizationId: appointment.organizationId,
    leadId: appointment.leadId,
    appointmentId: appointment.id,
    reason: "expired",
  });
  return { action: "expired" };
}

/** "Não" da equipe, 10 min depois: pergunta de novo, até 3 vezes; na última avisa o dono. */
export async function recheckAppointment(data: AppointmentWatchEventData): Promise<{ action: string }> {
  if (!data.checkId) return { action: "no_check" };
  const appointment = await loadAppointmentSnapshot(data.appointmentId);
  if (!appointment?.leadId) return { action: "no_lead" };
  if (!isSameSchedule(appointment, data) || !isActiveAppointment(appointment)) return { action: "stale" };
  const check = (await findChecks(appointment.id)).find((candidate) => candidate.id === data.checkId);
  if (!check || check.state.status !== "not_yet") return { action: "answered" };

  const askNumber = check.state.askCount + 1;
  const isReopened = await transitionCheck(check.id, ["not_yet"], {
    status: "pending",
    askCount: askNumber,
    lastAskedAt: new Date().toISOString(),
  });
  if (!isReopened) return { action: "answered" };
  await askTeam({ appointment, leadId: appointment.leadId, askNumber });
  return { action: "asked_again" };
}

async function notifyOwnerAboutMissingClient(appointment: AppointmentSnapshot, leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { name: true, conversation: { select: { id: true } } },
  });
  if (!lead) return;
  const adminIds = await resolveOrgAdmins(appointment.organizationId);
  for (const userId of adminIds) {
    await createNotification({
      userId,
      organizationId: appointment.organizationId,
      type: "APPOINTMENT_REMINDER",
      title: "Cliente não chegou",
      body: `${lead.name} não chegou para o agendamento depois de ${MAX_APPOINTMENT_CHECK_ASKS} conferências da equipe.`,
      appKey: "tracking",
      actionUrl: lead.conversation ? `/tracking-chat/${lead.conversation.id}` : undefined,
      severity: "warning",
    }).catch((error: unknown) => console.warn("[attendance] aviso ao dono falhou", error));
  }
}

/** Resposta da equipe no cartão interno do chat. */
export async function answerAppointmentCheck(params: {
  checkId: string;
  answer: AppointmentCheckAnswer;
  userId: string;
}): Promise<{ status: AppointmentCheckStatus | "already_answered" }> {
  const event = await prisma.leadJourneyEvent.findUnique({
    where: { id: params.checkId },
    select: { id: true, leadId: true, kind: true, metadata: true },
  });
  if (!event || event.kind !== "appointment_check") return { status: "already_answered" };
  const state = event.metadata as unknown as AppointmentCheckState;
  const appointment = await loadAppointmentSnapshot(state.appointmentId);
  if (!appointment) return { status: "already_answered" };
  const answeredAt = new Date().toISOString();
  const leadId = event.leadId;

  if (params.answer === "not_yet") {
    const isLastAsk = state.askCount >= MAX_APPOINTMENT_CHECK_ASKS;
    const nextStatus: AppointmentCheckStatus = isLastAsk ? "unanswered" : "not_yet";
    const isAnswered = await transitionCheck(event.id, ["pending"], { status: nextStatus, answeredBy: params.userId, answeredAt });
    if (!isAnswered) return { status: "already_answered" };
    if (isLastAsk) {
      await notifyOwnerAboutMissingClient(appointment, leadId);
    } else {
      const recheck: AppointmentWatchEventData = {
        appointmentId: appointment.id,
        organizationId: appointment.organizationId,
        stage: "recheck",
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        checkId: event.id,
        dueAt: new Date(Date.now() + APPOINTMENT_RECHECK_MINUTES * MINUTE_MS).toISOString(),
      };
      await inngest.send({ name: APPOINTMENT_WATCH_EVENT, data: recheck });
    }
    await refreshLeadInChat(leadId);
    return { status: nextStatus };
  }

  const finalStatus: AppointmentCheckStatus = params.answer === "attended" ? "attended" : "cancelled";
  const isAnswered = await transitionCheck(event.id, ["pending", "not_yet", "unanswered"], {
    status: finalStatus,
    answeredBy: params.userId,
    answeredAt,
  });
  if (!isAnswered) return { status: "already_answered" };

  const section = await findOpenSection(leadId);
  if (params.answer === "attended") {
    await prisma.appointment.updateMany({
      where: { id: appointment.id, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
      data: { status: "DONE" },
    });
    await recordAttendanceScore({ leadId, reason: "commitment_fulfilled", actorId: params.userId, sectionId: section?.id });
    await releaseScheduledTag({ organizationId: appointment.organizationId, leadId, appointmentId: appointment.id, reason: "finished" });
    await applyFinishedAttendance({ leadId, outcome: "FINISHED" });
  } else {
    await prisma.appointment.updateMany({
      where: { id: appointment.id, status: { in: ACTIVE_APPOINTMENT_STATUSES } },
      data: { status: "NO_SHOW" },
    });
    await recordAttendanceScore({ leadId, reason: "no_show", actorId: params.userId, sectionId: section?.id });
    await releaseScheduledTag({ organizationId: appointment.organizationId, leadId, appointmentId: appointment.id, reason: "no_show" });
    await applyFinishedAttendance({ leadId, outcome: "CANCELLED" });
    // "Cancelou" dispara a recuperação pelos fluxos "Lead com Tag".
    await addHistoryTag({ organizationId: appointment.organizationId, leadId, key: "cancelled", reason: "no_show", appointmentId: appointment.id });
  }
  await refreshLeadInChat(leadId);
  return { status: finalStatus };
}

/** Conferência aberta do lead, para o cartão do chat. */
export async function findPendingAppointmentCheck(leadId: string): Promise<{ id: string; state: AppointmentCheckState } | null> {
  const event = await prisma.leadJourneyEvent.findFirst({
    where: { leadId, kind: "appointment_check", metadata: { path: ["status"], equals: "pending" } },
    orderBy: { occurredAt: "desc" },
    select: { id: true, metadata: true },
  });
  return event ? { id: event.id, state: event.metadata as unknown as AppointmentCheckState } : null;
}
