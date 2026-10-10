import { tool, type ToolSet } from "ai";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import prisma from "@/lib/prisma";
import { inngest } from "@/inngest/client";
import { listAgendaFreeSlots } from "@/features/public-booking-chat/lib/booking-agent";
import { buildAppointmentPublicUrl } from "@/features/astro/actions/agenda/schedule-steps";
import {
  cancelAppointmentReminder,
  createAppointmentReminder,
  stopLeadReminders,
  type AppointmentReminderScope,
} from "../../lib/appointment-reminder";
import { requestLeadMetricsRecompute } from "@/features/leads/lib/metrics/request-recompute";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Agenda para o cliente no WhatsApp (spec 0084, Parte B).
 *
 * Tudo aqui é preso ao cliente da conversa: `leadId`, a empresa e as agendas
 * liberadas vêm do servidor. Nenhuma ferramenta aceita nome, telefone ou
 * documento para dizer de quem é o agendamento (RS-1, RS-2).
 */

const AGENDA_TIME_ZONE = "America/Sao_Paulo";
const DATE_INPUT = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Data no formato YYYY-MM-DD");
const TIME_INPUT = z.string().regex(/^\d{2}:\d{2}$/).describe("Horário no formato HH:mm");
const NOT_FOUND_REPLY = {
  error:
    "Não encontrei esse agendamento. Chame list_my_appointments, mostre ao cliente os agendamentos dele e pergunte qual é, usando o appointmentId da lista.",
};

export interface LeadAgendaScope {
  organizationId: string;
  trackingId: string;
  leadId: string;
  leadName: string | null;
  /** Agendas que a empresa liberou para o agente. */
  agendaIds: string[];
  /** Lembrete antes do horário (Parte E). Ausente = sem lembrete. */
  reminderScope?: AppointmentReminderScope;
}

/** Lembrete é complemento: falha nele nunca desfaz o agendamento. */
async function syncReminder(run: () => Promise<unknown>): Promise<void> {
  await run().catch((error: unknown) => console.warn("[tracking-chat-ai/agenda] lembrete falhou", error));
}

async function loadAllowedAgendas(scope: LeadAgendaScope) {
  if (scope.agendaIds.length === 0) return [];
  return prisma.agenda.findMany({
    where: { id: { in: scope.agendaIds }, organizationId: scope.organizationId, isActive: true },
    select: { id: true, name: true, slotDuration: true, trackingId: true },
    orderBy: { name: "asc" },
  });
}

function toStartsAt(date: string, time: string) {
  return dayjs.tz(`${date} ${time}`, AGENDA_TIME_ZONE);
}

async function hasConflict(agendaId: string, startsAt: Date, endsAt: Date, ignoreAppointmentId?: string) {
  const conflict = await prisma.appointment.findFirst({
    where: {
      agendaId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      status: { notIn: ["CANCELLED"] },
      ...(ignoreAppointmentId ? { id: { not: ignoreAppointmentId } } : {}),
    },
    select: { id: true },
  });
  return Boolean(conflict);
}

/** Só agendamento futuro, ativo, deste cliente e de agenda liberada. */
/**
 * O modelo às vezes manda um id que não existe. Quando o cliente tem um único agendamento
 * futuro, é dele que se trata: sem isso, "cancela minha consulta" falhava com a consulta ali.
 */
async function findOwnAppointment(scope: LeadAgendaScope, appointmentId: string | undefined) {
  const ownUpcoming = {
    leadId: scope.leadId,
    agendaId: { in: scope.agendaIds },
    agenda: { organizationId: scope.organizationId },
    status: { notIn: ["CANCELLED" as const] },
    startsAt: { gte: new Date() },
  };
  const select = { id: true, agendaId: true, startsAt: true, agenda: { select: { name: true, slotDuration: true } } };
  if (appointmentId) {
    const byId = await prisma.appointment.findFirst({ where: { ...ownUpcoming, id: appointmentId }, select });
    if (byId) return byId;
  }
  const upcoming = await prisma.appointment.findMany({ where: ownUpcoming, select, take: 2 });
  return upcoming.length === 1 ? upcoming[0] : null;
}

function describeAppointment(appointment: { id: string; startsAt: Date; agenda: { name: string } }) {
  const startsAt = dayjs(appointment.startsAt).tz(AGENDA_TIME_ZONE);
  return {
    appointmentId: appointment.id,
    agendaName: appointment.agenda.name,
    date: startsAt.format("DD/MM/YYYY"),
    time: startsAt.format("HH:mm"),
  };
}

export function makeLeadAgendaTools(scope: LeadAgendaScope): ToolSet {
  return {
    list_agendas: tool({
      description:
        "Lista as agendas (serviços) em que este cliente pode marcar horário. Use antes de ver horários quando houver mais de uma.",
      inputSchema: z.object({}),
      execute: async () => {
        const agendas = await loadAllowedAgendas(scope);
        return { agendas: agendas.map((agenda) => ({ agendaId: agenda.id, name: agenda.name })) };
      },
    }),

    get_available_slots: tool({
      description:
        "Horários livres de uma agenda numa data. Use SEMPRE antes de sugerir horário. Devolve só horários livres; nunca informa quem ocupa os demais.",
      inputSchema: z.object({ agendaId: z.string(), date: DATE_INPUT }),
      execute: async ({ agendaId, date }) => {
        const agenda = (await loadAllowedAgendas(scope)).find((allowed) => allowed.id === agendaId);
        if (!agenda) return { error: "Agenda indisponível." };
        return listAgendaFreeSlots({ agendaId: agenda.id, slotDuration: agenda.slotDuration }, date);
      },
    }),

    book_appointment: tool({
      description:
        "Marca um horário para o cliente desta conversa. Só chame depois de o cliente confirmar agenda, data e horário na conversa.",
      inputSchema: z.object({
        agendaId: z.string(),
        date: DATE_INPUT,
        time: TIME_INPUT,
        notes: z.string().max(500).optional().describe("Observação do cliente, se houver"),
      }),
      execute: async ({ agendaId, date, time, notes }) => {
        const agenda = (await loadAllowedAgendas(scope)).find((allowed) => allowed.id === agendaId);
        if (!agenda) return { error: "Agenda indisponível." };
        const startsAt = toStartsAt(date, time);
        if (!startsAt.isValid() || startsAt.isBefore(dayjs())) return { error: "Escolha um horário futuro." };
        const endsAt = startsAt.add(agenda.slotDuration, "minute");
        if (await hasConflict(agenda.id, startsAt.toDate(), endsAt.toDate())) {
          return { error: "Esse horário acabou de ser ocupado. Consulte os horários de novo." };
        }
        const appointment = await prisma.appointment.create({
          data: {
            agendaId: agenda.id,
            leadId: scope.leadId,
            trackingId: agenda.trackingId,
            startsAt: startsAt.toDate(),
            endsAt: endsAt.toDate(),
            title: `Agendamento: ${scope.leadName ?? "Cliente"}`,
            notes: notes ?? null,
            status: "PENDING",
          },
          select: { id: true, startsAt: true, agenda: { select: { name: true } } },
        });
        await inngest
          .send({ name: "appointment/booking.notification", data: { appointmentId: appointment.id, type: "created" } })
          .catch((error: unknown) => console.warn("[tracking-chat-ai/agenda] aviso de agendamento falhou", error));
        await requestLeadMetricsRecompute(scope.leadId);
        if (scope.reminderScope) {
          const reminderScope = scope.reminderScope;
          await syncReminder(() =>
            createAppointmentReminder(reminderScope, { startsAt: appointment.startsAt, agendaName: appointment.agenda.name }),
          );
        }
        return { success: true, ...describeAppointment(appointment), link: buildAppointmentPublicUrl(appointment.id) };
      },
    }),

    list_my_appointments: tool({
      description: "Lista os próximos agendamentos do cliente desta conversa. Use antes de remarcar ou cancelar.",
      inputSchema: z.object({}),
      execute: async () => {
        const appointments = await prisma.appointment.findMany({
          where: {
            leadId: scope.leadId,
            agendaId: { in: scope.agendaIds },
            agenda: { organizationId: scope.organizationId },
            status: { notIn: ["CANCELLED"] },
            startsAt: { gte: new Date() },
          },
          orderBy: { startsAt: "asc" },
          take: 10,
          select: { id: true, startsAt: true, agenda: { select: { name: true } } },
        });
        return { appointments: appointments.map(describeAppointment) };
      },
    }),

    cancel_my_appointment: tool({
      description:
        "Cancela um agendamento do cliente desta conversa, só depois de o cliente confirmar. Use o appointmentId vindo de list_my_appointments; se o cliente tiver um único agendamento, pode omitir. Remarcação proposta e ainda não confirmada não existe: o que vale é o que list_my_appointments mostra.",
      inputSchema: z.object({ appointmentId: z.string().optional() }),
      execute: async ({ appointmentId }) => {
        const appointment = await findOwnAppointment(scope, appointmentId);
        if (!appointment) return NOT_FOUND_REPLY;
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "CANCELLED", cancelledBy: "CLIENT" },
        });
        await inngest
          .send({ name: "appointment/booking.notification", data: { appointmentId: appointment.id, type: "cancelled" } })
          .catch((error: unknown) => console.warn("[tracking-chat-ai/agenda] aviso de cancelamento falhou", error));
        await requestLeadMetricsRecompute(scope.leadId);
        if (scope.reminderScope) {
          const reminderScope = scope.reminderScope;
          await syncReminder(() => cancelAppointmentReminder(reminderScope, appointment.startsAt));
        }
        return { success: true, cancelled: describeAppointment(appointment) };
      },
    }),

    ...(scope.reminderScope
      ? {
          stop_my_reminders: tool({
            description:
              "Desliga os lembretes de agendamento deste cliente. Use quando ele responder \"parar\", \"sair\" ou pedir para não receber mais lembretes.",
            inputSchema: z.object({}),
            execute: async () => {
              await stopLeadReminders(scope.reminderScope!);
              return { success: true };
            },
          }),
        }
      : {}),

    reschedule_my_appointment: tool({
      description:
        "Muda a data e o horário de um agendamento do cliente desta conversa. Consulte os horários livres antes e só chame depois de o cliente confirmar. Use o appointmentId vindo de list_my_appointments; se o cliente tiver um único agendamento, pode omitir.",
      inputSchema: z.object({ appointmentId: z.string().optional(), date: DATE_INPUT, time: TIME_INPUT }),
      execute: async ({ appointmentId, date, time }) => {
        const appointment = await findOwnAppointment(scope, appointmentId);
        if (!appointment) return NOT_FOUND_REPLY;
        const startsAt = toStartsAt(date, time);
        if (!startsAt.isValid() || startsAt.isBefore(dayjs())) return { error: "Escolha um horário futuro." };
        const endsAt = startsAt.add(appointment.agenda.slotDuration, "minute");
        if (await hasConflict(appointment.agendaId, startsAt.toDate(), endsAt.toDate(), appointment.id)) {
          return { error: "Esse horário está ocupado. Consulte os horários de novo." };
        }
        const updated = await prisma.appointment.update({
          where: { id: appointment.id },
          data: { startsAt: startsAt.toDate(), endsAt: endsAt.toDate() },
          select: { id: true, startsAt: true, agenda: { select: { name: true } } },
        });
        if (scope.reminderScope) {
          const reminderScope = scope.reminderScope;
          await syncReminder(async () => {
            await cancelAppointmentReminder(reminderScope, appointment.startsAt);
            await createAppointmentReminder(reminderScope, { startsAt: updated.startsAt, agendaName: updated.agenda.name });
          });
        }
        return { success: true, ...describeAppointment(updated), link: buildAppointmentPublicUrl(updated.id) };
      },
    }),
  };
}
