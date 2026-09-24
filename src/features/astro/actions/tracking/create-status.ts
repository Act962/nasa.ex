import "server-only";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";

// Criar coluna no tracking (spec 0024, onda 1). Entra no fim do funil, que é
// onde uma etapa nova quase sempre vai — quem quiser no meio arrasta depois.

const DEFAULT_COLOR = "#1447e6";

const inputSchema = z.object({
  statusName: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .describe("Nome da coluna, ex: 'Proposta enviada'."),
  trackingName: z
    .string()
    .trim()
    .min(2)
    .optional()
    .describe("Tracking onde criar. Sem isso, usa o único da organização."),
});

export const createStatusAction: AstroAction<typeof inputSchema> = {
  key: "tracking.create_status",
  app: "tracking",
  toolName: "create_tracking_status",
  description:
    "Cria uma coluna NOVA no funil — 'cria a coluna X', 'adiciona a etapa X'. Não renomeia coluna existente. " +
    "Use quando o usuário quiser acrescentar uma etapa ao board.",
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

    const duplicate = await prisma.status.findFirst({
      where: {
        trackingId: tracking.id,
        name: { equals: input.statusName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Coluna já existe",
        description: `O tracking ${tracking.name} já tem uma coluna "${input.statusName}".`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Criar coluna",
        description: `A coluna "${input.statusName}" será criada em ${tracking.name}.`,
        appName: "Tracking",
      };
    }

    const lastStatus = await prisma.status.findFirst({
      where: { trackingId: tracking.id },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    await prisma.status.create({
      data: {
        name: input.statusName,
        color: DEFAULT_COLOR,
        trackingId: tracking.id,
        order: lastStatus ? new Decimal(lastStatus.order).plus(1) : new Decimal(0),
      },
    });

    return {
      status: "done",
      title: "Coluna criada",
      description: `"${input.statusName}" entrou no fim do funil ${tracking.name}.`,
      internalUrl: `/tracking/${tracking.id}`,
      appName: "Tracking",
    };
  },
};
