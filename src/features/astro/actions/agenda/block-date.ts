import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Bloquear ou liberar um dia na agenda (spec 0024, onda 1). Bloquear não
// cancela o que já está marcado — só impede agendamento novo naquele dia.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("Dia no formato YYYY-MM-DD, já resolvido para data absoluta."),
  agendaName: z
    .string()
    .trim()
    .optional()
    .describe("Agenda a bloquear. Sem isso, usa a única da organização."),
  blocked: z
    .boolean()
    .describe("true para bloquear o dia, false para liberar."),
});

export const blockAgendaDateAction: AstroAction<typeof inputSchema> = {
  key: "agenda.block_date",
  toolName: "block_agenda_date",
  description:
    "Bloqueia ou libera um dia específico numa agenda. " +
    "Use quando o usuário disser 'bloqueia o dia 30 na minha agenda', 'libera o dia 5'.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const candidates = await prisma.agenda.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(input.agendaName
          ? { name: { contains: input.agendaName, mode: "insensitive" } }
          : {}),
      },
      select: { id: true, name: true },
      take: MAX_CANDIDATES,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Agenda não encontrada",
        description: input.agendaName
          ? `Não achei agenda com "${input.agendaName}".`
          : "Você ainda não tem agenda nenhuma.",
        missingFields: [{ key: "agendaName", label: "nome da agenda" }],
        appName: "Agendas",
      };
    }

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Em qual agenda?",
        description: `Você tem ${candidates.length} agendas. Em qual bloquear o dia?`,
        field: "agendaName",
        options: candidates.map((a) => ({ id: a.id, label: a.name })),
        appName: "Agendas",
      };
    }

    const agenda = candidates[0];

    // Bloquear um dia que já tem gente marcada confunde: o horário some da
    // oferta mas os compromissos continuam. Melhor avisar do que só fazer.
    const startOfDay = new Date(`${input.date}T00:00:00`);
    const endOfDay = new Date(`${input.date}T23:59:59`);
    const booked = await prisma.appointment.count({
      where: {
        agendaId: agenda.id,
        status: { notIn: ["CANCELLED"] },
        startsAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (dryRun) {
      return {
        status: "done",
        title: input.blocked ? "Bloquear dia" : "Liberar dia",
        description:
          `${input.date} será ${input.blocked ? "bloqueado" : "liberado"} em ${agenda.name}.` +
          (booked > 0 ? ` Atenção: já há ${booked} agendamento(s) nesse dia.` : ""),
        appName: "Agendas",
      };
    }

    await prisma.agendaDateOverride.upsert({
      where: { agendaId_date: { agendaId: agenda.id, date: input.date } },
      create: { agendaId: agenda.id, date: input.date, isBlocked: input.blocked },
      update: { isBlocked: input.blocked },
    });

    return {
      status: "done",
      title: input.blocked ? "Dia bloqueado" : "Dia liberado",
      description:
        `${input.date} ${input.blocked ? "não aceita mais" : "voltou a aceitar"} agendamento em ${agenda.name}.` +
        (input.blocked && booked > 0
          ? ` Os ${booked} agendamento(s) já marcados continuam de pé.`
          : ""),
      internalUrl: "/agendas",
      appName: "Agendas",
    };
  },
};
