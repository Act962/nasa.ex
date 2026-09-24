import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "../tracking/resolve-tracking";

// Criar agenda. Mesma lacuna da criação de tracking: sem verbo próprio,
// "cria uma agenda de consultoria" cairia em `agenda.toggle_active`.

const DEFAULT_SLOT_MINUTES = 30;

const inputSchema = z.object({
  agendaName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe("Nome da agenda, ex: 'Consultoria'."),
  trackingName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Funil a que a agenda pertence. Sem isso, usa o único da organização."),
  slotDuration: z
    .number()
    .int()
    .min(5)
    .max(480)
    .optional()
    .describe("Duração de cada horário, em minutos. Sem isso, 30."),
});

/** Slug único por organização — o sufixo evita colisão sem perguntar nada. */
function buildSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "agenda"}-${Date.now().toString(36)}`;
}

export const createAgendaAction: AstroAction<typeof inputSchema> = {
  key: "agenda.create",
  app: "agenda",
  toolName: "create_agenda",
  description:
    "Cria uma AGENDA nova, o calendário em si — 'cria uma agenda de consultoria', 'nova agenda para atendimento'. " +
    "Não é marcar compromisso nem ativar agenda existente.",
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const slotDuration = input.slotDuration ?? DEFAULT_SLOT_MINUTES;

    const duplicate = await prisma.agenda.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: input.agendaName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Agenda já existe",
        description: `Já existe uma agenda chamada "${input.agendaName}".`,
        internalUrl: "/agendas",
        openLabel: "Abrir Agendas",
        appName: "Agendas",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar agenda",
        description: `"${input.agendaName}" será criada em ${tracking.name}, com horários de ${slotDuration} min.`,
        appName: "Agendas",
      };
    }

    const agenda = await prisma.agenda.create({
      data: {
        name: input.agendaName,
        slug: buildSlug(input.agendaName),
        slotDuration,
        trackingId: tracking.id,
        organizationId: ctx.organizationId,
        responsibles: { create: { userId: ctx.userId } },
      },
      select: { id: true, name: true },
    });

    return {
      status: "done",
      title: "Agenda criada",
      description: `"${agenda.name}", com horários de ${slotDuration} min.`,
      internalUrl: "/agendas",
      openLabel: "Abrir Agendas",
      appName: "Agendas",
    };
  },
};
