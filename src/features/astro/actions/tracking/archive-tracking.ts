import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleTracking } from "./resolve-tracking";

// Arquivar tracking (spec 0024, onda 1 — terceiro destrutivo).
//
// Arquivar não apaga na hora: o board sai da lista e a exclusão definitiva
// acontece 30 dias depois, como na tela. Ainda assim é D-4, porque leva junto
// todos os leads do board da vista de quem trabalha nele.

const inputSchema = z.object({
  trackingName: z.string().trim().min(2).describe("Nome do tracking a arquivar."),
});

export const archiveTrackingAction: AstroAction<typeof inputSchema> = {
  key: "tracking.archive",
  app: "tracking",
  toolName: "archive_tracking",
  description:
    "Arquiva um tracking inteiro. " +
    "Use quando o usuário disser 'arquiva o tracking X', 'tira o funil X da lista'.",
  permission: { appKey: "tracking", action: "delete" },
  requiresConfirmation: true,
  confirmTitle: "Arquivar tracking",
  confirmWarnings: [
    "O board sai da lista com todos os seus leads. A exclusão definitiva ocorre em 30 dias.",
  ],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleTracking({
      ctx,
      name: input.trackingName,
      field: "trackingName",
    });
    if ("failure" in resolved) return resolved.failure;
    const tracking = resolved.tracking;

    const leadCount = await prisma.lead.count({
      where: { trackingId: tracking.id },
    });

    if (dryRun) {
      return {
        status: "done",
        title: "Arquivar tracking",
        description: `${tracking.name} será arquivado, com ${leadCount} lead(s).`,
        appName: "Tracking",
      };
    }

    await prisma.tracking.update({
      where: { id: tracking.id },
      data: { archivedAt: new Date() },
    });

    const actor = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, image: true },
    });

    await logActivity({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "tracking.archived",
      action: "tracking.archived",
      actionLabel: `Arquivou o tracking "${tracking.name}" pelo Astro`,
      resource: tracking.name,
      resourceId: tracking.id,
      metadata: { via: "astro", leadCount },
    });

    return {
      status: "done",
      title: "Tracking arquivado",
      description: `${tracking.name} saiu da lista com ${leadCount} lead(s). Exclusão definitiva em 30 dias.`,
      internalUrl: "/tracking",
      appName: "Tracking",
    };
  },
};
