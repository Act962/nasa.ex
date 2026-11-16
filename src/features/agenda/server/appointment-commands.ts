import "server-only";
import { ORPCError } from "@orpc/server";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { Prisma } from "@/generated/prisma/client";
import type { AppointmentStatus, MeetingType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { recordAppointmentChange } from "@/features/org-defaults/lib/attendance/appointment";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { DEFAULT_AGENDA_TIMEZONE } from "./agenda-slots";

dayjs.extend(utc);
dayjs.extend(timezone);

// Marcar, remarcar e cancelar: o núcleo de gravar compromisso é o mesmo para todos os caminhos de agendamento
// (tela, página pública, chat de agendamento, IA do WhatsApp, Astro, barra de comandos e MCP). Specs 0146 e 0147.

export interface AgendaActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface ActorContext {
  organizationId: string;
  actor: AgendaActor;
  /** Nome da IA externa: entra no histórico de atividades. */
  via?: string;
}

const withVia = (label: string, via?: string) => (via ? `${label} (via ${via})` : label);
const viaMetadata = (via?: string) => (via ? { via } : {});

export interface CreateAgendaAppointmentInput {
  agendaId: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:mm" */
  time: string;
  timeZone?: string;
  name: string;
  phone: string;
  email?: string;
  title?: string;
  notes?: string;
  meetingType?: "ONLINE" | "IN_PERSON";
  /** Lead que já existe na empresa (MCP). Sem ele, busca pelo telefone no funil da agenda ou cria. */
  leadId?: string;
}

/**
 * Lead do agendamento: o que já existe com esse telefone no funil da agenda, ou um novo na coluna configurada na
 * agenda (ou na primeira) com as etiquetas dela. `leadData` completa o lead novo (ex.: UTM da página pública).
 */
export async function findOrCreateAgendaLead(
  agenda: { trackingId: string; statusId: string | null; tags: { id: string }[] },
  input: { name: string; phone: string; email?: string | null; leadData?: Partial<Prisma.LeadUncheckedCreateInput> },
) {
  const existing = await prisma.lead.findFirst({ where: { phone: input.phone, trackingId: agenda.trackingId } });
  if (existing) return { lead: existing, isNewLead: false };

  let statusId = agenda.statusId;
  if (!statusId) {
    const firstStatus = await prisma.status.findFirst({ where: { trackingId: agenda.trackingId }, orderBy: { order: "asc" } });
    if (!firstStatus) throw new ORPCError("BAD_REQUEST", { message: "A trilha da agenda não possui status configurados." });
    statusId = firstStatus.id;
  }

  const lead = await prisma.lead.create({
    data: { name: input.name, phone: input.phone, email: input.email || null, trackingId: agenda.trackingId, statusId, source: "AGENDA", ...input.leadData },
  });
  // Só adiciona as etiquetas da agenda ao lead novo; lead que já existia não entra aqui.
  if (agenda.tags.length > 0) {
    await prisma.leadTag.createMany({ data: agenda.tags.map((tag) => ({ leadId: lead.id, tagId: tag.id })), skipDuplicates: true });
  }
  return { lead, isNewLead: true };
}

export interface AgendaAppointmentData {
  agendaId: string;
  startsAt: Date;
  endsAt: Date;
  title: string;
  status: AppointmentStatus;
  leadId?: string | null;
  userId?: string | null;
  trackingId?: string | null;
  notes?: string | null;
  meetingType?: MeetingType;
}

export type InsertAgendaAppointmentResult =
  | { ok: true; appointment: Prisma.AppointmentGetPayload<{ include: { agenda: { select: { name: true } } } }> }
  | { ok: false; conflict: { id: string; title: string | null; startsAt: Date } | null };

/**
 * Confere o horário e grava numa transação serializável: dois pedidos no mesmo instante não marcam o mesmo horário.
 * `conflict` nulo quer dizer que a transação concorrente venceu; quem chama trata como horário ocupado.
 */
export async function insertAgendaAppointment(data: AgendaAppointmentData): Promise<InsertAgendaAppointmentResult> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.appointment.findFirst({
          where: { agendaId: data.agendaId, startsAt: { lt: data.endsAt }, endsAt: { gt: data.startsAt }, status: { notIn: ["CANCELLED"] } },
          select: { id: true, title: true, startsAt: true },
        });
        if (conflict) return { ok: false as const, conflict };
        const appointment = await tx.appointment.create({
          data: {
            agendaId: data.agendaId,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            title: data.title,
            status: data.status,
            leadId: data.leadId ?? null,
            userId: data.userId ?? null,
            trackingId: data.trackingId ?? null,
            notes: data.notes ?? null,
            ...(data.meetingType ? { meetingType: data.meetingType } : {}),
          },
          include: { agenda: { select: { name: true } } },
        });
        return { ok: true as const, appointment };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    // P2034: conflito de escrita na transação serializável, outro pedido gravou no mesmo horário.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return { ok: false, conflict: null };
    throw error;
  }
}

export async function createAgendaAppointment({ organizationId, actor, via, input }: ActorContext & { input: CreateAgendaAppointmentInput }) {
  const agenda = await prisma.agenda.findFirst({
    where: { id: input.agendaId, organizationId, isActive: true },
    select: { id: true, name: true, slotDuration: true, trackingId: true, statusId: true, tags: { select: { id: true } } },
  });
  if (!agenda) throw new ORPCError("NOT_FOUND", { message: "Agenda não encontrada" });

  const startsAt = dayjs.tz(`${input.date} ${input.time}`, input.timeZone || DEFAULT_AGENDA_TIMEZONE);
  const endsAt = startsAt.add(agenda.slotDuration, "minute");

  const isTaken = await prisma.appointment.findFirst({
    where: { agendaId: agenda.id, startsAt: { lt: endsAt.toDate() }, endsAt: { gt: startsAt.toDate() }, status: { notIn: ["CANCELLED"] } },
    select: { id: true },
  });
  if (isTaken) throw new ORPCError("BAD_REQUEST", { message: "Este horário já está preenchido." });

  const lead = input.leadId
    ? await prisma.lead.findFirst({ where: { id: input.leadId, tracking: { organizationId } } })
    : (await findOrCreateAgendaLead(agenda, input)).lead;
  if (!lead) throw new ORPCError("NOT_FOUND", { message: "Lead não encontrado" });

  const inserted = await insertAgendaAppointment({
    agendaId: agenda.id,
    leadId: lead.id,
    userId: actor.id,
    startsAt: startsAt.toDate(),
    endsAt: endsAt.toDate(),
    title: input.title?.trim() || `Agendamento: ${input.name}`,
    notes: input.notes,
    status: "CONFIRMED",
    trackingId: agenda.trackingId,
    meetingType: input.meetingType,
  });
  if (!inserted.ok) throw new ORPCError("BAD_REQUEST", { message: "Este horário já está preenchido." });
  const { appointment } = inserted;

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "spacetime",
    action: "appointment_create",
    actionLabel: withVia(`Criou agendamento para ${input.name} em ${input.date} às ${input.time} (${agenda.name})`, via),
    resource: input.name,
    resourceId: appointment.id,
    metadata: { agendaName: agenda.name, date: input.date, time: input.time, phone: input.phone, ...viaMetadata(via) },
  });

  await chargeStarsByAction(organizationId, "appointment_create", {
    userId: actor.id,
    description: `Criou agendamento (${agenda.name})`,
    appSlug: "spacetime",
  });

  await recordAppointmentChange({ appointmentId: appointment.id, change: "scheduled", actorId: actor.id }).catch((error: unknown) =>
    console.warn("[agenda.createAdmin] atendimento do agendamento falhou", error),
  );

  return appointment;
}

export async function rescheduleAgendaAppointment({
  organizationId,
  actor,
  via,
  appointmentId,
  startsAt: newStart,
  endsAt: newEnd,
}: ActorContext & { appointmentId: string; startsAt: Date; endsAt: Date }) {
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, agenda: { organizationId }, status: { notIn: ["CANCELLED"] } },
    select: { id: true, agendaId: true, endsAt: true, startsAt: true },
  });
  if (!appointment) throw new ORPCError("NOT_FOUND", { message: "Agendamento não encontrado" });

  const conflict = await prisma.appointment.findFirst({
    where: { id: { not: appointmentId }, agendaId: appointment.agendaId, status: { notIn: ["CANCELLED"] }, startsAt: { lt: newEnd }, endsAt: { gt: newStart } },
  });
  if (conflict) throw new ORPCError("BAD_REQUEST", { message: "Já existe um agendamento neste horário." });

  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: { startsAt: newStart, endsAt: newEnd } });

  const formatDateTime = (date: Date) =>
    date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_AGENDA_TIMEZONE });
  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "spacetime",
    action: "appointment.rescheduled",
    actionLabel: withVia(`Reagendou agendamento para ${formatDateTime(newStart)}`, via),
    resourceId: appointmentId,
    metadata: { oldStart: appointment.startsAt, newStart, newEnd, ...viaMetadata(via) },
  });

  await recordAppointmentChange({ appointmentId, change: "rescheduled", actorId: actor.id, previousStartsAt: appointment.startsAt }).catch(
    (error: unknown) => console.warn("[agenda.reschedule] atendimento do agendamento falhou", error),
  );

  return updated;
}

export async function cancelAgendaAppointment({ organizationId, actor, via, appointmentId }: ActorContext & { appointmentId: string }) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, agenda: { organizationId } } });
  if (!appointment) throw new ORPCError("BAD_REQUEST", { message: "Appointment not found" });
  if (appointment.status === "CANCELLED") throw new ORPCError("BAD_REQUEST", { message: "Appointment is already cancelled" });

  const updated = await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CANCELLED", cancelledBy: "SYSTEM" } });

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "spacetime",
    action: "appointment.cancelled",
    actionLabel: withVia(`Cancelou agendamento "${appointment.title ?? appointmentId}"`, via),
    resourceId: appointmentId,
    metadata: { previousStatus: appointment.status, ...viaMetadata(via) },
  });

  await recordAppointmentChange({ appointmentId, change: "cancelled", actorId: actor.id }).catch((error: unknown) =>
    console.warn("[agenda.cancel] atendimento do agendamento falhou", error),
  );

  return updated;
}
