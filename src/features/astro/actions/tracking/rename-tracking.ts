import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";

// Renomear o funil inteiro. `tracking.rename_status` renomeia COLUNA; o
// quadro em si não tinha verbo.

const inputSchema = z.object({
  trackingName: z.string().trim().min(2).describe("Funil a renomear."),
  newName: z.string().trim().min(2).max(80).describe("Novo nome do funil."),
});

export const renameTrackingAction: AstroAction<typeof inputSchema> = {
  key: "tracking.rename",
  app: "tracking",
  toolName: "rename_tracking_board",
  description:
    "RENOMEIA um funil inteiro — 'renomeia o tracking Vendas para Comercial'. " +
    "É o quadro, não a coluna dentro dele.",
  permission: { appKey: "tracking", action: "edit" },
  requiresConfirmation: false,
  newNameFields: ["newName"],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const duplicate = await prisma.tracking.findFirst({
      where: {
        organizationId: ctx.organizationId,
        name: { equals: input.newName, mode: "insensitive" },
        id: { not: tracking.id },
      },
      select: { id: true },
    });
    if (duplicate) {
      return {
        status: "error",
        title: "Nome já usado",
        description: `Já existe outro funil chamado "${input.newName}".`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Renomear funil",
        description: `"${tracking.name}" passará a se chamar "${input.newName}".`,
        appName: "Tracking",
      };
    }

    await prisma.tracking.update({
      where: { id: tracking.id },
      data: { name: input.newName },
    });

    return {
      status: "done",
      title: "Funil renomeado",
      description: `"${tracking.name}" agora é "${input.newName}".`,
      internalUrl: `/tracking/${tracking.id}`,
      openLabel: "Abrir no Tracking",
      appName: "Tracking",
    };
  },
};
