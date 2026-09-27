import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";
import { LEAD_FIELD_STEP } from "./lead-steps";
import { buildPickedAnswer, parsePickedAnswer } from "@/features/astro/lib/astro-picker";

/** "move a Maria Clara para Ganho" → lead e coluna, sem modelo. */
function inferMoveFields(text: string): Record<string, unknown> {
  const match = text.match(
    /\b(?:move|mover|mova|passa|passar|joga|jogar)\s+(?:o\s+|a\s+)?(?:lead\s+)?(.+?)\s+(?:para|pra|pro)\s+(?:a\s+|o\s+)?(?:coluna\s+|etapa\s+)?(.+?)[.!?]*$/iu,
  );
  if (!match) {
    // "move para Qualificado", "move ele pra Ganho": só o destino na frase.
    const statusOnly = text.match(
      /\b(?:move|mover|mova|passa|passar|joga|jogar)\s+(?:ele\s+|ela\s+)?(?:para|pra|pro)\s+(?:a\s+|o\s+)?(?:coluna\s+|etapa\s+)?(.+?)[.!?]*$/iu,
    )?.[1];
    return statusOnly && statusOnly.trim().length >= 2 ? { statusName: statusOnly.trim() } : {};
  }
  const inferred: Record<string, unknown> = {};
  const leadName = match[1].trim();
  if (leadName.length >= 2 && !/^(um|uma|o|a)?\s*lead$/i.test(leadName)) inferred.leadName = leadName;
  if (match[2].trim().length >= 2) inferred.statusName = match[2].trim();
  return inferred;
}

// Mover lead de coluna — o gesto mais repetido do board, e o verbo que
// faltava: "mover para a coluna Em andamento" caía em `tracking.create_status`
// e acabava pedindo o nome de uma coluna nova.

const inputSchema = z.object({
  leadName: z.string().trim().min(2).describe("Lead a mover. Pode ser parcial."),
  statusName: z
    .string()
    .trim()
    .min(2)
    .optional()
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
  inferFields: inferMoveFields,
  intentPatterns: [
    /\b(move|mover|mova)\b/,
    /\b(passa|passar|joga|jogar)\b.{0,40}\b(para|pra)\s+(a\s+|o\s+)?(coluna|etapa)\b/,
  ],
  fieldSteps: { leadName: LEAD_FIELD_STEP },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    // As colunas do funil do lead viram opções fixas: o usuário escolhe, não digita.
    const columns = await prisma.status.findMany({
      where: { trackingId: lead.trackingId },
      select: { id: true, name: true },
      orderBy: { order: "asc" },
      take: 20,
    });
    const askColumn = (title: string, description: string): AstroActionResult => ({
      status: "ambiguous",
      title,
      description,
      field: "statusName",
      options: columns.map((column) => ({ id: column.id, label: column.name })),
      appName: "Tracking",
      picker: {
        kind: "select",
        options: columns.map((column) => ({
          label: column.name,
          answer: buildPickedAnswer(column.name, column.id),
        })),
      },
    });

    if (!input.statusName) {
      return askColumn("Para qual coluna?", `Para qual coluna eu movo ${lead.name}?`);
    }

    const pickedColumn = parsePickedAnswer(input.statusName);
    const statuses = pickedColumn.id
      ? columns.filter((column) => column.id === pickedColumn.id)
      : columns.filter((column) =>
          column.name.toLowerCase().includes(pickedColumn.label.toLowerCase()),
        );

    if (statuses.length === 0) {
      return askColumn(
        "Coluna não encontrada",
        `${lead.tracking.name} não tem coluna com "${pickedColumn.label}". Para qual delas?`,
      );
    }
    if (statuses.length > 1) {
      return askColumn("Qual coluna?", `Achei ${statuses.length} colunas parecidas com "${pickedColumn.label}".`);
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
