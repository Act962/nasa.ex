import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";

// Criar tracking (funil inteiro), não coluna dentro de um. "Crie um novo
// tracking" caía em `tracking.create_status` e criava a coluna ATENDIMENTO
// dentro do FINANCEIRO: sem o verbo, a etapa 2 escolhe o vizinho.
//
// Nasce sem coluna, como no orquestrador — quem configura o funil é o usuário,
// na tela de etapas, e é para lá que o cartão aponta.

const inputSchema = z.object({
  trackingName: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .describe("Nome do funil, ex: 'Atendimento'."),
});

export const createTrackingAction: AstroAction<typeof inputSchema> = {
  key: "tracking.create",
  app: "tracking",
  toolName: "create_tracking_board",
  description:
    "Cria um FUNIL inteiro, um board novo — 'cria um tracking', 'novo funil de atendimento'. " +
    "Não confunda com coluna: aqui nasce o quadro, não uma etapa dentro de um quadro que já existe.",
  requiresConfirmation: false,
  newNameFields: ["trackingName"],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const duplicate = await prisma.tracking.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: input.trackingName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Tracking já existe",
        description: `Já existe um funil chamado "${input.trackingName}".`,
        internalUrl: `/tracking/${duplicate.id}`,
        openLabel: "Abrir no Tracking",
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar tracking",
        description: `O funil "${input.trackingName}" será criado.`,
        appName: "Tracking",
      };
    }

    const tracking = await prisma.tracking.create({
      data: {
        name: input.trackingName,
        organizationId: ctx.organizationId,
        participants: { create: { userId: ctx.userId, role: "OWNER" } },
      },
      select: { id: true, name: true },
    });

    return {
      status: "done",
      title: "Tracking criado",
      description: `"${tracking.name}" está pronto. Falta configurar as etapas.`,
      internalUrl: `/tracking/${tracking.id}/settings`,
      openLabel: "Configurar etapas",
      appName: "Tracking",
    };
  },
};
