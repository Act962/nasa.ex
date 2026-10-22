import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { buildAppointmentPublicUrl, formatAgendaDateTime, resolveWhenOrAsk } from "./schedule-steps";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import { extractNameAfter } from "../leads/lead-steps";

const APPOINTMENT_PICKER: AstroPicker = {
  kind: "entity",
  entity: "appointment",
  placeholder: "Buscar compromisso por título ou lead",
};

/** "a reunião da Maria Clara", "o compromisso com o Kauê" → de quem é. */
function inferAppointmentOwner(text: string): string | undefined {
  return extractNameAfter(text, ["da", "do", "com", "de"]);
}


// Remarcar agendamento (spec 0024, onda 1). É o pedido mais frequente da
// agenda e hoje custa navegação: abrir, achar o card, arrastar.
//
// A checagem de conflito e o log são os mesmos da procedure
// `agenda/appointments/reschedule.ts` — o que muda é a porta de entrada.

const MAX_CANDIDATES = 5;
const DEFAULT_DURATION_MINUTES = 60;

const inputSchema = z.object({
  personName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome de quem tem o agendamento. Pode ser parcial."),
  startsAt: z
    .string()
    .trim()
    .optional()
    .describe("Quando, com as palavras do usuário: 'sexta às 15h', 'amanhã 9h'."),
  spokenWhen: z.string().optional().describe("Frase original do usuário."),
  answeredWhen: z.string().optional().describe("Resposta do usuário à pergunta de data/hora."),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional()
    .describe("Duração. Sem isso, mantém a duração atual do agendamento."),
});


export const rescheduleAppointmentAction: AstroAction<typeof inputSchema> = {
  key: "agenda.reschedule_appointment",
  app: "agenda",
  toolName: "reschedule_appointment",
  description:
    "Remarca um agendamento existente para outro horário. " +
    "Use quando o usuário disser 'remarca o Fulano para sexta às 15h', " +
    "'muda o horário do agendamento do Fulano', 'adia a reunião do Fulano'.",
  permission: { appKey: "spacetime", action: "edit" },
  requiresConfirmation: true,
  input: inputSchema,
  inferFields: (text) => {
    const personName = inferAppointmentOwner(text);
    return { spokenWhen: text, ...(personName ? { personName } : {}) };
  },
  codeOnlyFields: ["spokenWhen", "answeredWhen"],
  accumulatingFields: ["answeredWhen"],
  intentPatterns: [
    /\b(remarca|remarcar|remarque|adia|adiar|adie)\b/,
    /\b(muda|mudar|troca|trocar)\s+o\s+horario\b/,
  ],
  fieldSteps: {
    personName: { title: "Qual compromisso?", question: "Busque o compromisso.", picker: APPOINTMENT_PICKER },
  },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const pickedAppointment = parsePickedAnswer(input.personName);
    const candidates = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: ctx.organizationId },
        status: { notIn: ["CANCELLED"] },
        ...(pickedAppointment.id
          ? { id: pickedAppointment.id }
          : {
              OR: [
                { title: { contains: pickedAppointment.label, mode: "insensitive" } },
                { lead: { name: { contains: pickedAppointment.label, mode: "insensitive" } } },
              ],
            }),
      },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        agendaId: true,
        lead: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
      take: MAX_CANDIDATES,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Agendamento não encontrado",
        description: `Não achei compromisso de "${pickedAppointment.label}". Busque abaixo.`,
        missingFields: [{ key: "personName", label: "o compromisso" }],
        appName: "Agendas",
        picker: APPOINTMENT_PICKER,
      };
    }

    // Dois agendamentos da mesma pessoa não viram escolha nossa: remarcar o
    // errado é pior do que perguntar.
    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um agendamento",
        description: `${pickedAppointment.label} tem ${candidates.length} compromissos. Qual deles?`,
        field: "personName",
        options: candidates.map((appointment) => ({
          id: appointment.id,
          label: `${appointment.title} — ${formatAgendaDateTime(appointment.startsAt)}`,
        })),
        appName: "Agendas",
        picker: APPOINTMENT_PICKER,
      };
    }

    const appointment = candidates[0];

    const resolvedWhen = resolveWhenOrAsk({
      answeredWhen: input.answeredWhen,
      spokenWhen: input.spokenWhen,
      startsAt: input.startsAt,
      verb: "remarco",
    });
    if ("ask" in resolvedWhen) return resolvedWhen.ask;
    const newStart = new Date(resolvedWhen.iso);
    const durationMs = input.durationMinutes
      ? input.durationMinutes * 60_000
      : appointment.endsAt.getTime() - appointment.startsAt.getTime() ||
        DEFAULT_DURATION_MINUTES * 60_000;
    const newEnd = new Date(newStart.getTime() + durationMs);

    const conflict = await prisma.appointment.findFirst({
      where: {
        id: { not: appointment.id },
        agendaId: appointment.agendaId,
        status: { notIn: ["CANCELLED"] },
        startsAt: { lt: newEnd },
        endsAt: { gt: newStart },
      },
      select: { title: true, startsAt: true },
    });

    if (conflict) {
      return {
        status: "needs_input",
        title: "Horário ocupado",
        description:
          `Horário ocupado: já existe "${conflict.title}" em ${formatAgendaDateTime(conflict.startsAt)}. ` +
          "Escolha outro horário.",
        missingFields: [{ key: "answeredWhen", label: "outro horário" }],
        appName: "Agendas",
        picker: { kind: "datetime", mode: "datetime" },
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Remarcar agendamento",
        description:
          `"${appointment.title}" sai de ${formatAgendaDateTime(appointment.startsAt)} ` +
          `para ${formatAgendaDateTime(newStart)}.`,
        appName: "Agendas",
      };
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { startsAt: newStart, endsAt: newEnd },
    });

    // O log exige identidade de quem agiu. Escrita feita pelo Astro ainda é
    // escrita de uma pessoa — sem isso, some da auditoria.
    const actor = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, image: true },
    });

    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "spacetime",
      action: "appointment.rescheduled",
      actionLabel: `Reagendou via Astro para ${formatAgendaDateTime(newStart)}`,
      resourceId: appointment.id,
      metadata: {
        oldStart: appointment.startsAt,
        newStart,
        newEnd,
        via: "astro",
      },
    });

    return {
      status: "done",
      title: "Agendamento remarcado",
      description:
        `"${appointment.title}" saiu de ${formatAgendaDateTime(appointment.startsAt)} ` +
        `para ${formatAgendaDateTime(newStart)}.`,
      internalUrl: `/agendas?appointment=${appointment.id}`,
      publicUrl: buildAppointmentPublicUrl(appointment.id),
      appName: "Agendas",
    };
  },
};
