import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";
import { extractTrackingName } from "../leads/lead-steps";
import { NEW_NAME_STEP, extractNamedThing, extractNewName } from "./tracking-steps";
import { buildPickedAnswer, parsePickedAnswer } from "@/features/astro/lib/astro-picker";

// Renomear coluna do tracking (spec 0024, onda 1).

const inputSchema = z.object({
  currentName: z.string().trim().min(1).optional().describe("Nome atual da coluna."),
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
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  input: inputSchema,
  inferFields: (text) => {
    const currentName = extractNamedThing(text, "coluna|etapa");
    const newName = extractNewName(text);
    const trackingName = extractTrackingName(text);
    return {
      ...(currentName ? { currentName } : {}),
      ...(newName ? { newName } : {}),
      ...(trackingName ? { trackingName } : {}),
    };
  },
  intentPatterns: [/\b(renomeia|renomear|renomeie|muda o nome|mudar o nome|troca o nome|trocar o nome)\b.{0,20}\b(coluna|etapa)\b/],
  fieldSteps: { newName: NEW_NAME_STEP },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    // As colunas do funil viram opções fixas: escolher, não lembrar o nome exato.
    const columns = await prisma.status.findMany({
      where: { trackingId: tracking.id },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
      take: 20,
    });
    const askColumn = (title: string, description: string): AstroActionResult => ({
      status: "ambiguous",
      title,
      description,
      field: "currentName",
      options: columns.map((column) => ({ id: column.id, label: column.name })),
      appName: "Tracking",
      picker: {
        kind: "select",
        options: columns.map((column) => ({ label: column.name, answer: buildPickedAnswer(column.name, column.id) })),
      },
    });
    if (!input.currentName) return askColumn("Qual coluna?", `Qual coluna de ${tracking.name} renomear?`);

    const picked = parsePickedAnswer(input.currentName);
    const matches = picked.id
      ? columns.filter((column) => column.id === picked.id)
      : columns.filter((column) => column.name.toLowerCase().includes(picked.label.toLowerCase()));
    if (matches.length === 0) {
      return askColumn("Coluna não encontrada", `${tracking.name} não tem coluna com "${picked.label}". Qual delas?`);
    }
    if (matches.length > 1) {
      return askColumn("Qual coluna?", `Achei ${matches.length} colunas parecidas com "${picked.label}".`);
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
