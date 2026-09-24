import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { inferPolarity } from "../infer-polarity";

// Bloquear ou liberar um dia na agenda (spec 0024, onda 1). Bloquear não
// cancela o que já está marcado — só impede agendamento novo naquele dia.

const MAX_CANDIDATES = 5;

/**
 * "Bloqueia o dia 30" é o jeito que as pessoas falam, e exigir YYYY-MM-DD do
 * modelo só gera parse quebrado. Resolver o dia solto é conta de calendário —
 * código faz melhor e sem token.
 */
function normalizeDate(raw: string, today = new Date()): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dayOnly = trimmed.match(/^(\d{1,2})$/);
  if (!dayOnly) return null;

  const day = Number(dayOnly[1]);
  if (day < 1 || day > 31) return null;

  // Próxima ocorrência desse dia: este mês se ainda não passou, senão o mês
  // seguinte. Ninguém pede para bloquear um dia que já foi.
  const candidate = new Date(today.getFullYear(), today.getMonth(), day);
  if (candidate < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    candidate.setMonth(candidate.getMonth() + 1);
  }
  const month = String(candidate.getMonth() + 1).padStart(2, "0");
  return `${candidate.getFullYear()}-${month}-${String(candidate.getDate()).padStart(2, "0")}`;
}

const inputSchema = z.object({
  date: z
    .string()
    .trim()
    .min(1)
    .describe("Dia em YYYY-MM-DD, ou só o número do dia ('30')."),
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
  app: "agenda",
  toolName: "block_agenda_date",
  // Primeira frase carrega o sinal (convenção da spec 0024): "bloquear dia"
  // precisa ganhar de "desativar agenda", que é o vizinho mais próximo.
  description:
    "Bloqueia ou libera UM DIA do calendário de uma agenda, sem desativar a agenda inteira — 'bloqueia o dia 30', 'libera o dia 5'. " +
    "Converta o dia dito para a data absoluta mais próxima no futuro.",
  permission: { appKey: "spacetime", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) =>
    inferPolarity(text, "blocked", /\blibera|\bdesbloque/i, /\bbloque|\bfech/i),

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const date = normalizeDate(input.date);
    if (!date) {
      return {
        status: "needs_input",
        title: "Dia não entendido",
        description: `Não consegui ler "${input.date}" como um dia.`,
        missingFields: [{ key: "date", label: "o dia" }],
        appName: "Agendas",
      };
    }

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
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(`${date}T23:59:59`);
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
          `${date} será ${input.blocked ? "bloqueado" : "liberado"} em ${agenda.name}.` +
          (booked > 0 ? ` Atenção: já há ${booked} agendamento(s) nesse dia.` : ""),
        appName: "Agendas",
      };
    }

    await prisma.agendaDateOverride.upsert({
      where: { agendaId_date: { agendaId: agenda.id, date: date } },
      create: { agendaId: agenda.id, date: date, isBlocked: input.blocked },
      update: { isBlocked: input.blocked },
    });

    return {
      status: "done",
      title: input.blocked ? "Dia bloqueado" : "Dia liberado",
      description:
        `${date} ${input.blocked ? "não aceita mais" : "voltou a aceitar"} agendamento em ${agenda.name}.` +
        (input.blocked && booked > 0
          ? ` Os ${booked} agendamento(s) já marcados continuam de pé.`
          : ""),
      internalUrl: "/agendas",
      appName: "Agendas",
    };
  },
};
