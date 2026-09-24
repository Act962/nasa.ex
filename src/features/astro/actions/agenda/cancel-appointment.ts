import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";

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

function formatDateTime(value: Date): string {
  return value.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const candidates = await prisma.appointment.findMany({
      where: {
        agenda: { organizationId: ctx.organizationId },
        status: { notIn: ["CANCELLED"] },
        OR: [
          { title: { contains: input.personName, mode: "insensitive" } },
          { lead: { name: { contains: input.personName, mode: "insensitive" } } },
        ],
      },
      select: { id: true, title: true, startsAt: true, status: true },
      orderBy: { startsAt: "asc" },
      take: MAX_CANDIDATES,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Agendamento não encontrado",
        description: `Não achei agendamento ativo de "${input.personName}".`,
        missingFields: [{ key: "personName", label: "de quem é o agendamento" }],
        appName: "Agendas",
      };
    }

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de um agendamento",
        description: `${input.personName} tem ${candidates.length} agendamentos ativos. Qual cancelar?`,
        field: "personName",
        options: candidates.map((appointment) => ({
          id: appointment.id,
          label: `${appointment.title} — ${formatDateTime(appointment.startsAt)}`,
        })),
        appName: "Agendas",
      };
    }

    const appointment = candidates[0];

    if (dryRun) {
      return {
        status: "done",
        title: "Cancelar agendamento",
        description:
          `"${appointment.title}" de ${formatDateTime(appointment.startsAt)} será cancelado.`,
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
        `"${appointment.title}" de ${formatDateTime(appointment.startsAt)} foi cancelado.`,
      internalUrl: `/agendas?appointment=${appointment.id}`,
      appName: "Agendas",
    };
  },
};
