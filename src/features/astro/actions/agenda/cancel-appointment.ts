import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { formatAgendaDateTime } from "./schedule-steps";
import { parsePickedAnswer, type AstroPicker } from "@/features/astro/lib/astro-picker";
import { extractNameAfter } from "../leads/lead-steps";

const APPOINTMENT_PICKER: AstroPicker = {
  kind: "entity",
  entity: "appointment",
  placeholder: "Buscar compromisso por título ou lead",
};

// Cancelar agendamento (spec 0024, onda 1 — segundo destrutivo).
//
// Cancelar não apaga: o registro vira `status: CANCELLED`, como na tela. Ainda
// assim entra em D-4, porque para quem marcou o efeito é o mesmo — o horário
// some da agenda e o cliente é avisado.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  personName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome de quem tem o agendamento. Pode ser parcial."),
});


export const cancelAppointmentAction: AstroAction<typeof inputSchema> = {
  key: "agenda.cancel_appointment",
  app: "agenda",
  toolName: "cancel_appointment",
  description:
    "Cancela um agendamento existente. " +
    "Use quando o usuário disser 'cancela o agendamento do Fulano', " +
    "'desmarca a reunião do Fulano'.",
  permission: { appKey: "spacetime", action: "delete" },
  requiresConfirmation: true,
  confirmTitle: "Cancelar agendamento",
  confirmWarnings: [
    "O horário é liberado na agenda e o cliente pode ser avisado do cancelamento.",
  ],
  input: inputSchema,
  inferFields: (text) => {
    const personName = extractNameAfter(text, ["da", "do", "com", "de"]);
    return personName ? { personName } : {};
  },
  intentPatterns: [
    /\b(cancela|cancelar|cancele|desmarca|desmarcar|desmarque)\b.{0,30}\b(reuniao|compromisso|consulta|agendamento|horario|visita|call|encontro)\b/,
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
      select: { id: true, title: true, startsAt: true, status: true },
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

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um agendamento",
        description: `${pickedAppointment.label} tem ${candidates.length} compromissos. Qual cancelar?`,
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

    if (dryRun) {
      return {
        status: "done",
        title: "Cancelar agendamento",
        description:
          `"${appointment.title}" de ${formatAgendaDateTime(appointment.startsAt)} será cancelado.`,
        appName: "Agendas",
      };
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CANCELLED", cancelledBy: "SYSTEM" },
    });

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
      action: "appointment.cancelled",
      actionLabel: `Cancelou "${appointment.title}" pelo Astro`,
      resourceId: appointment.id,
      metadata: {
        via: "astro",
        previousStatus: appointment.status,
        startsAt: appointment.startsAt,
      },
    });

    return {
      status: "done",
      title: "Agendamento cancelado",
      description:
        `"${appointment.title}" de ${formatAgendaDateTime(appointment.startsAt)} foi cancelado.`,
      internalUrl: `/agendas?appointment=${appointment.id}`,
      appName: "Agendas",
    };
  },
};
