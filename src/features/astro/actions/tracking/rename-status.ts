import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";

// Renomear coluna do tracking (spec 0024, onda 1).

const inputSchema = z.object({
  currentName: z.string().trim().min(1).describe("Nome atual da coluna."),
  newName: z.string().trim().min(2).max(60).describe("Novo nome."),
  trackingName: z
    .string()
    .trim()
    .optional()
    .describe("Tracking da coluna. Sem isso, usa o único da organização."),
});

export const renameStatusAction: AstroAction<typeof inputSchema> = {
  key: "tracking.rename_status",
  app: "tracking",
  toolName: "rename_tracking_status",
  // Vizinho direto do `create_status`: a primeira frase precisa deixar claro
  // que aqui a coluna JÁ EXISTE e só troca de nome (convenção da spec 0024).
  description:
    "Troca o NOME de uma coluna que já existe — 'renomeia a coluna X para Y', 'muda o nome da etapa X'. Não cria coluna nova. " +
    "Precisa do nome atual e do novo.",
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

    const matches = await prisma.status.findMany({
      where: {
        trackingId: tracking.id,
        name: { contains: input.currentName, mode: "insensitive" },
      },
      select: { id: true, name: true },
      take: 5,
    });

    if (matches.length === 0) {
      return {
        status: "needs_input",
        title: "Coluna não encontrada",
        description: `${tracking.name} não tem coluna parecida com "${input.currentName}".`,
        missingFields: [{ key: "currentName", label: "nome atual da coluna" }],
        appName: "Tracking",
      };
    }

    if (matches.length > 1) {
      return {
        status: "ambiguous",
        title: "Mais de uma coluna",
        description: `Achei ${matches.length} colunas parecidas com "${input.currentName}". Qual?`,
        field: "currentName",
        options: matches.map((s) => ({ id: s.id, label: s.name })),
        appName: "Tracking",
      };
    }

    const target = matches[0];

    if (dryRun) {
      return {
        status: "done",
        title: "Renomear coluna",
        description: `"${target.name}" passará a se chamar "${input.newName}".`,
        appName: "Tracking",
      };
    }

    await prisma.status.update({
      where: { id: target.id },
      data: { name: input.newName },
    });

    return {
      status: "done",
      title: "Coluna renomeada",
      description: `"${target.name}" virou "${input.newName}" em ${tracking.name}.`,
      internalUrl: `/tracking/${tracking.id}`,
      appName: "Tracking",
    };
  },
};
