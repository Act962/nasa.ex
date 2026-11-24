import "server-only";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import type { DayOfWeek } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

dayjs.extend(utc);
dayjs.extend(timezone);

// Horários de uma agenda num dia: bloqueio do dia, disponibilidade da data (que substitui a da semana) e fuso.
// É o cálculo da página pública de agendamento, usado também pelo MCP (spec 0146, D-2).

export const DEFAULT_AGENDA_TIMEZONE = "America/Sao_Paulo";

const DAY_OF_WEEK: DayOfWeek[] = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export interface AgendaTimeSlot {
  id: string;
  startTime: string;
  fillTime: string;
  isOccupied: boolean;
  isPast: boolean;
  isBlocked: boolean;
}

export async function computeAgendaTimeSlots(params: {
  agenda: { id: string; slotDuration: number };
  /** "YYYY-MM-DD" */
  date: string;
  timeZone?: string;
  includeUnavailable?: boolean;
}): Promise<AgendaTimeSlot[]> {
  const { agenda, date } = params;
  const includeUnavailable = !!params.includeUnavailable;
  const tz = params.timeZone || DEFAULT_AGENDA_TIMEZONE;

  const dateOverride = await prisma.agendaDateOverride.findUnique({ where: { agendaId_date: { agendaId: agenda.id, date } } });
  const isDateBlocked = !!dateOverride?.isBlocked;
  if (isDateBlocked && !includeUnavailable) return [];

  const requestedDate = dayjs.tz(date, "YYYY-MM-DD", tz);
  const dayName = DAY_OF_WEEK[requestedDate.day()];

  const dateAvailability = await prisma.agendaDateAvailability.findUnique({
    where: { agendaId_date: { agendaId: agenda.id, date } },
    include: { timeSlots: { orderBy: { order: "asc" } } },
  });
  const timeSlotRanges = dateAvailability
    ? dateAvailability.timeSlots.map((slot) => ({ id: slot.id, startTime: slot.startTime, endTime: slot.endTime }))
    : await prisma.availabilityTimeSlot.findMany({
        where: { availability: { agendaId: agenda.id, dayOfWeek: dayName, isActive: true } },
        orderBy: { order: "asc" },
      });

  const appointments = await prisma.appointment.findMany({
    where: {
      agendaId: agenda.id,
      startsAt: { gte: requestedDate.startOf("day").toDate(), lte: requestedDate.endOf("day").toDate() },
      status: { not: "CANCELLED" },
    },
  });

  const slots: AgendaTimeSlot[] = [];
  const now = dayjs().tz(tz);
  const isToday = requestedDate.isSame(now, "day");

  for (const range of timeSlotRanges) {
    let current = dayjs.tz(`${requestedDate.format("YYYY-MM-DD")}T${range.startTime}`, tz);
    const end = dayjs.tz(`${requestedDate.format("YYYY-MM-DD")}T${range.endTime}`, tz);

    // O fim da faixa também vale como início: 8h–12h de 60 min oferece 8, 9, 10, 11 e 12.
    while (current.isBefore(end) || current.isSame(end)) {
      const slotStart = current;
      const slotEnd = current.add(agenda.slotDuration, "minute");
      const isPast = isToday && slotStart.isBefore(now);
      const isOccupied = appointments.some((appointment) => slotStart.isBefore(dayjs(appointment.endsAt)) && slotEnd.isAfter(dayjs(appointment.startsAt)));

      if (includeUnavailable) {
        slots.push({ id: `${range.id}-${slotStart.format("HHmm")}`, startTime: slotStart.format("HH:mm"), fillTime: slotEnd.format("HH:mm"), isOccupied, isPast, isBlocked: isDateBlocked });
      } else if (!isPast && !isOccupied) {
        slots.push({ id: `${range.id}-${slotStart.format("HHmm")}`, startTime: slotStart.format("HH:mm"), fillTime: slotEnd.format("HH:mm"), isOccupied: false, isPast: false, isBlocked: false });
      }
      current = slotEnd;
    }
  }

  return slots;
}

export type AgendaFreeSlotsReply =
  | { error: string; slots?: [] }
  | { date: string; slots: { startTime: string; endTime: string }[]; totalAvailable: number; message?: string };

/**
 * Horários livres de um dia no formato que o chat de agendamento e a IA do WhatsApp mandam ao modelo: só início e fim
 * de cada horário livre, nunca quem ocupa os outros. Mesmo cálculo da página pública (spec 0147).
 */
export async function listAgendaFreeSlots(agenda: { agendaId: string; slotDuration: number }, date: string): Promise<AgendaFreeSlotsReply> {
  const requestedDate = dayjs.tz(date, "YYYY-MM-DD", DEFAULT_AGENDA_TIMEZONE);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !requestedDate.isValid()) return { error: "Data inválida." };
  if (requestedDate.isBefore(dayjs().tz(DEFAULT_AGENDA_TIMEZONE), "day")) return { error: "Não é possível consultar datas passadas.", slots: [] };

  const override = await prisma.agendaDateOverride.findUnique({ where: { agendaId_date: { agendaId: agenda.agendaId, date } }, select: { isBlocked: true } });
  if (override?.isBlocked) return { date, slots: [], totalAvailable: 0, message: "Esta data está indisponível. Por favor, escolha outra data." };

  const slots = await computeAgendaTimeSlots({ agenda: { id: agenda.agendaId, slotDuration: agenda.slotDuration }, date });
  const freeSlots = slots.map((slot) => ({ startTime: slot.startTime, endTime: slot.fillTime }));
  return freeSlots.length > 0
    ? { date, slots: freeSlots, totalAvailable: freeSlots.length }
    : { date, slots: [], totalAvailable: 0, message: "Sem horário livre neste dia." };
}
