import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";

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
    .datetime()
    .describe("Novo início, em ISO 8601, já resolvido para data absoluta."),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .optional()
    .describe("Duração. Sem isso, mantém a duração atual do agendamento."),
});

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const rescheduleAppointmentAction: AstroAction<typeof inputSchema> = {
  key: "agenda.reschedule_appointment",
  toolName: "reschedule_appointment",
  description:
    "Remarca um agendamento existente para outro horário. " +
    "Use quando o usuário disser 'remarca o Fulano para sexta às 15h', " +
    "'muda o horário do agendamento do Fulano', 'adia a reunião do Fulano'.",
  requiresConfirmation: true,
  input: inputSchema,

  async execute({ ctx, input }): Promise<AstroActionResult> {
    const candidates = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: ctx.organizationId },
        status: { notIn: ["CANCELLED"] },
        OR: [
          { title: { contains: input.personName, mode: "insensitive" } },
          { lead: { name: { contains: input.personName, mode: "insensitive" } } },
        ],
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
        description: `Não achei agendamento ativo de "${input.personName}". Confere o nome?`,
        missingFields: [{ key: "personName", label: "de quem é o agendamento" }],
        appName: "Agendas",
      };
    }

    // Dois agendamentos da mesma pessoa não viram escolha nossa: remarcar o
    // errado é pior do que perguntar.
    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um agendamento",
        description: `${input.personName} tem ${candidates.length} agendamentos ativos. Qual deles?`,
        field: "personName",
        options: candidates.map((appointment) => ({
          id: appointment.id,
          label: `${appointment.title} — ${formatDateTime(appointment.startsAt)}`,
        })),
        appName: "Agendas",
      };
    }

    const appointment = candidates[0];
    const newStart = new Date(input.startsAt);
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
        status: "error",
        title: "Horário ocupado",
        description:
          `Já existe "${conflict.title}" em ${formatDateTime(conflict.startsAt)}. ` +
          "Escolha outro horário.",
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
      actionLabel: `Reagendou via Astro para ${formatDateTime(newStart)}`,
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
        `"${appointment.title}" saiu de ${formatDateTime(appointment.startsAt)} ` +
        `para ${formatDateTime(newStart)}.`,
      internalUrl: `/agendas?appointment=${appointment.id}`,
      appName: "Agendas",
    };
  },
};
