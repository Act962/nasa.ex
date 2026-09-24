import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";

// Mover lead de coluna — o gesto mais repetido do board, e o verbo que
// faltava: "mover para a coluna Em andamento" caía em `tracking.create_status`
// e acabava pedindo o nome de uma coluna nova.

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Lead a mover. Pode ser parcial."),
  statusName: z
    .string()
    .trim()
    .min(2)
    .describe("Coluna de destino, ex: 'Em andamento'."),
});

export const moveLeadAction: AstroAction<typeof inputSchema> = {
  key: "lead.move",
  app: "leads",
  toolName: "move_lead_to_status",
  description:
    "MOVE um lead para outra coluna do funil — 'move o Fulano para Em andamento', 'passa o Fulano para Ganhos'. " +
    "É mudar a etapa de um lead que já existe; não cria coluna nem renomeia nenhuma.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const statuses = await prisma.status.findMany({
      where: {
        trackingId: lead.trackingId,
        name: { contains: input.statusName, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: 5,
    });

    if (statuses.length === 0) {
      const available = await prisma.status.findMany({
        where: { trackingId: lead.trackingId },
        select: { id: true, name: true },
        orderBy: { order: "asc" },
        take: 8,
      });
      return {
        status: "ambiguous",
        title: "Coluna não encontrada",
        description:
          `${lead.tracking.name} não tem coluna com "${input.statusName}". Para qual delas?`,
        field: "statusName",
        options: available.map((item) => ({ id: item.id, label: item.name })),
        appName: "Tracking",
      };
    }

    if (statuses.length > 1) {
      return {
        status: "ambiguous",
        title: "Qual coluna?",
        description: `Achei ${statuses.length} colunas parecidas com "${input.statusName}".`,
        field: "statusName",
        options: statuses.map((item) => ({ id: item.id, label: item.name })),
        appName: "Tracking",
      };
    }

    const target = statuses[0];

    const current = await prisma.lead.findUnique({
      where: { id: lead.id },
      select: { statusId: true, status: { select: { name: true } } },
    });
    if (current?.statusId === target.id) {
      return {
        status: "error",
        title: "Já está lá",
        description: `${lead.name} já está em "${target.name}".`,
        internalUrl: `/tracking/${lead.trackingId}`,
        openLabel: "Abrir no Tracking",
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Mover lead",
        description: `${lead.name} irá de "${current?.status?.name ?? "—"}" para "${target.name}".`,
        appName: "Tracking",
      };
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { statusId: target.id, statusEnteredAt: new Date() },
    });

    return {
      status: "done",
      title: "Lead movido",
      description: `${lead.name} foi para "${target.name}" em ${lead.tracking.name}.`,
      internalUrl: `/tracking/${lead.trackingId}`,
      openLabel: "Abrir no Tracking",
      appName: "Tracking",
    };
  },
};
