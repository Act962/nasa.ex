import "server-only";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import type { AstroAction, AstroActionResult } from "../types";
import { resolveSingleLead } from "./resolve-lead";
import { LEAD_FIELD_STEP, normalizeIntent } from "./lead-steps";

const MASS_TARGET = /^(todos|todas|tudo|os leads|todos os leads|todos os contatos)\b/;

/** "exclui o lead João Pedro" → nome, sem modelo. "apaga todos os leads" também vira campo — e recusa. */
function inferDeleteFields(text: string): Record<string, unknown> {
  const normalized = normalizeIntent(text);
  if (/\b(todos|todas|tudo)\b.{0,20}\b(leads?|contatos?|clientes?)\b/.test(normalized)) {
    return { leadName: "todos os leads" };
  }
  const leadName = text.match(/\b(?:lead|contato|cliente)\s+(?:o\s+|a\s+)?(.+?)[.!?]*$/iu)?.[1]?.trim();
  return leadName && leadName.length >= 2 ? { leadName } : {};
}

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
  app: "leads",
  toolName: "delete_lead",
  description:
    "Exclui um lead do tracking, de forma permanente. " +
    "Use quando o usuário disser 'apaga o lead X', 'exclui o X', 'remove o lead duplicado'.",
  permission: { appKey: "tracking", action: "delete" },
  requiresConfirmation: true,
  confirmTitle: "Excluir lead permanentemente",
  confirmWarnings: [
    "A exclusão é permanente: histórico, mensagens e anexos do lead vão junto.",
  ],
  input: inputSchema,
  inferFields: inferDeleteFields,
  intentPatterns: [
    /^(?!.*\b(tag|etiqueta|nota|anotacao|participante|responsavel)\b).*\b(exclui|excluir|exclua|apaga|apagar|apague|deleta|deletar|delete|remove|remover|remova)\b.{0,20}\b(lead|leads|contato|contatos)\b/,
  ],
  fieldSteps: { leadName: LEAD_FIELD_STEP },

  async execute({ ctx, input, dryRun }): Promise<AstroActionResult> {
    // Exclusão em massa nunca sai do chat, nem com confirmação (F6-06).
    if (MASS_TARGET.test(normalizeIntent(input.leadName))) {
      const total = await prisma.lead.count({ where: { tracking: { organizationId: ctx.organizationId } } });
      return {
        status: "error",
        title: "Exclusão em massa não é feita pelo ASTRO",
        description:
          `Isso apagaria os ${total} leads da empresa — e não excluo em massa pelo chat. ` +
          "Para excluir vários, selecione os leads no Tracking e use a ação em lote. Nada foi excluído.",
        internalUrl: "/tracking",
        openLabel: "Abrir o Tracking",
        appName: "Tracking",
      };
    }

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
