import "server-only";
import prisma from "@/lib/prisma";
import { atBrasiliaTime, findTrackingByName, sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

const BUSINESS_HOURS_SLOTS = [
  { startTime: "09:00", endTime: "12:00", order: 0 },
  { startTime: "13:00", endTime: "18:00", order: 1 },
];

const WEEK_DAYS = [
  { dayOfWeek: "SUNDAY", isActive: false },
  { dayOfWeek: "MONDAY", isActive: true },
  { dayOfWeek: "TUESDAY", isActive: true },
  { dayOfWeek: "WEDNESDAY", isActive: true },
  { dayOfWeek: "THURSDAY", isActive: true },
  { dayOfWeek: "FRIDAY", isActive: true },
  { dayOfWeek: "SATURDAY", isActive: false },
] as const;

const SLOT_DURATION_MINUTES = 30;

function nextBusinessDay(afterBusinessDays: number, hour: number): Date {
  const date = new Date();
  let remainingDays = afterBusinessDays;
  while (remainingDays > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const weekDay = date.getUTCDay();
    if (weekDay !== 0 && weekDay !== 6) remainingDays -= 1;
  }
  return atBrasiliaTime(date, hour);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export async function seedSampleAgenda(context: SampleSeedContext): Promise<void> {
  const atendimentoTracking = findTrackingByName(context, "Atendimento");
  if (!atendimentoTracking) return;

  const firstAppointmentStart = nextBusinessDay(1, 10);
  const secondAppointmentStart = nextBusinessDay(2, 15);

  await prisma.agenda.create({
    data: {
      name: sampleName("Agenda de atendimento"),
      description: "Horários para o cliente agendar uma conversa ou visita com a equipe.",
      slug: "agenda-de-atendimento",
      slotDuration: SLOT_DURATION_MINUTES,
      isActive: true,
      trackingId: atendimentoTracking.id,
      organizationId: context.organizationId,
      responsibles: { create: { userId: context.ownerUserId } },
      availabilities: {
        create: WEEK_DAYS.map((weekDay) => ({
          dayOfWeek: weekDay.dayOfWeek,
          isActive: weekDay.isActive,
          timeSlots: { create: BUSINESS_HOURS_SLOTS },
        })),
      },
      appointments: {
        create: [
          {
            title: "Apresentação dos produtos (exemplo)",
            notes: "Cliente quer conhecer a linha completa antes de fechar o primeiro pedido.",
            startsAt: firstAppointmentStart,
            endsAt: addMinutes(firstAppointmentStart, SLOT_DURATION_MINUTES),
            status: "CONFIRMED",
            meetingType: "ONLINE",
            userId: context.ownerUserId,
            trackingId: atendimentoTracking.id,
          },
          {
            title: "Visita técnica na loja (exemplo)",
            notes: "Levar catálogo impresso e tabela de preços atualizada.",
            startsAt: secondAppointmentStart,
            endsAt: addMinutes(secondAppointmentStart, SLOT_DURATION_MINUTES),
            status: "PENDING",
            meetingType: "IN_PERSON",
            userId: context.ownerUserId,
            trackingId: atendimentoTracking.id,
          },
        ],
      },
    },
  });
}
