import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { inferPolarity } from "../infer-polarity";

// Ativar/desativar agenda (spec 0024, onda 1). Agenda desativada para de
// aceitar agendamento público; os já marcados continuam de pé.

const MAX_CANDIDATES = 5;

const inputSchema = z.object({
  agendaName: z.string().trim().min(2).describe("Nome da agenda."),
  active: z.boolean().describe("true para ativar, false para desativar."),
});

export const toggleAgendaActiveAction: AstroAction<typeof inputSchema> = {
  key: "agenda.toggle_active",
  app: "agenda",
  toolName: "toggle_agenda_active",
  description:
    "Ativa ou desativa uma agenda. " +
    "Use quando o usuário disser 'desativa a agenda X', 'reativa a agenda X'.",
  permission: { appKey: "spacetime", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) =>
    inferPolarity(text, "active", /\bdesativ|\bdesabilit|\bpaus/i, /\bativ|\breativ|\bhabilit/i),

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const candidates = await prisma.agenda.findMany({
      where: {
        organizationId: ctx.organizationId,
        name: { contains: input.agendaName, mode: "insensitive" },
      },
      select: { id: true, name: true, isActive: true },
      take: MAX_CANDIDATES,
    });

    if (candidates.length === 0) {
      return {
        status: "needs_input",
        title: "Agenda não encontrada",
        description: `Não achei agenda com "${input.agendaName}".`,
        missingFields: [{ key: "agendaName", label: "nome da agenda" }],
        appName: "Agendas",
      };
    }

    if (candidates.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de uma agenda",
        description: `Achei ${candidates.length} agendas parecidas com "${input.agendaName}". Qual?`,
        field: "agendaName",
        options: candidates.map((a) => ({ id: a.id, label: a.name })),
        appName: "Agendas",
      };
    }

    const agenda = candidates[0];

    if (agenda.isActive === input.active) {
      return {
        status: "done",
        title: input.active ? "Já estava ativa" : "Já estava desativada",
        description: `A agenda ${agenda.name} já está como você pediu.`,
        appName: "Agendas",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: input.active ? "Ativar agenda" : "Desativar agenda",
        description: `${agenda.name} será ${input.active ? "ativada" : "desativada"}.`,
        appName: "Agendas",
      };
    }

    await prisma.agenda.update({
      where: { id: agenda.id },
      data: { isActive: input.active },
    });

    return {
      status: "done",
      title: input.active ? "Agenda ativada" : "Agenda desativada",
      description: input.active
        ? `${agenda.name} voltou a aceitar agendamentos.`
        : `${agenda.name} parou de aceitar novos agendamentos. Os já marcados seguem de pé.`,
      internalUrl: "/agendas",
      appName: "Agendas",
    };
  },
};
