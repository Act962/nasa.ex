import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";

// Excluir lead (spec 0024, onda 1 — primeiro verbo destrutivo).
//
// A permissão é a mesma da procedure `leads/delete.ts`: owner/admin/moderador
// da organização, ou OWNER do tracking. Não é porque o pedido veio pelo Astro
// que a regra afrouxa — o `ctx.userId` é o mesmo usuário.
//
// Confirmação é obrigatória (D-4) e a exclusão entra em `systemActivityLog`,
// que é de onde os Insights leem o histórico.

const ALLOWED_ORG_ROLES = ["owner", "admin", "moderador"];

const inputSchema = z.object({
  leadName: z
    .string()
    .trim()
    .min(2)
    .describe("Nome do lead a excluir. Pode ser parcial."),
});

export const deleteLeadAction: AstroAction<typeof inputSchema> = {
  key: "lead.delete",
  app: "tracking",
  toolName: "delete_lead",
  description:
    "Exclui um lead do tracking, de forma permanente. " +
    "Use quando o usuário disser 'apaga o lead X', 'exclui o X', 'remove o lead duplicado'.",
  requiresConfirmation: true,
  confirmTitle: "Excluir lead permanentemente",
  confirmWarnings: [
    "A exclusão é permanente: histórico, mensagens e anexos do lead vão junto.",
  ],
  input: inputSchema,

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    const resolved = await resolveSingleLead({
      ctx,
      name: input.leadName,
      field: "leadName",
      appName: "Tracking",
      ambiguityHint: "Qual deles? Não vou adivinhar numa exclusão.",
    });
    if ("failure" in resolved) return resolved.failure;
    const lead = resolved.lead;

    const [membership, participation] = await Promise.all([
      prisma.member.findFirst({
        where: { userId: ctx.userId, organizationId: lead.tracking.organizationId },
        select: { role: true },
      }),
      prisma.trackingParticipant.findFirst({
        where: { userId: ctx.userId, trackingId: lead.trackingId },
        select: { role: true },
      }),
    ]);

    const allowed =
      (membership?.role && ALLOWED_ORG_ROLES.includes(membership.role)) ||
      participation?.role === "OWNER";

    if (!allowed) {
      return {
        status: "error",
        title: "Sem permissão",
        description: `Você não tem permissão para excluir o lead "${lead.name}".`,
        appName: "Tracking",
      };
    }

    if (dryRun) {
      return {
        status: "done",
        title: "Excluir lead",
        description: `"${lead.name}" do tracking ${lead.tracking.name} será excluído.`,
        appName: "Tracking",
      };
    }

    await prisma.lead.delete({ where: { id: lead.id } });

    const actor = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { name: true, email: true, image: true },
    });

    // Mesmos campos da exclusão feita pela tela, para as duas aparecerem lado
    // a lado no relatório dos Insights. `via: "astro"` distingue a origem.
    await logActivity({
      organizationId: lead.tracking.organizationId,
      userId: ctx.userId,
      userName: actor?.name ?? "—",
      userEmail: actor?.email ?? "—",
      userImage: actor?.image,
      appSlug: "tracking",
      subAppSlug: "tracking-pipeline",
      featureKey: "lead.deleted",
      action: "lead.deleted",
      actionLabel: `Excluiu o lead "${lead.name}" pelo Astro`,
      resource: lead.name,
      resourceId: lead.id,
      metadata: { via: "astro", trackingName: lead.tracking.name },
    });

    return {
      status: "done",
      title: "Lead excluído",
      description: `"${lead.name}" foi removido do tracking ${lead.tracking.name}.`,
      internalUrl: `/tracking/${lead.trackingId}`,
      appName: "Tracking",
    };
  },
};
