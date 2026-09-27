// Ação "Lembrar a equipe" (spec 0039, RF-6): notificação para o responsável
// do lead ou para quem criou o gatilho. Não fala com o lead.

import "server-only";
import prisma from "@/lib/prisma";
import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import type { NodeExecutor } from "../run-workflow";
import { interpolate } from "../workflow-context";

export const WORKFLOW_REMINDER_EVENT = "workflow.reminder";

function readString(record: Record<string, unknown> | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export const notifyTeamExecutor: NodeExecutor = async ({ data, context, dryRun }) => {
  const message = interpolate(context, readString(data, "message") ?? "").trim();
  if (!message) {
    return { output: { error: "message_missing" }, status: "FAILED", errorMessage: "Lembrete sem mensagem." };
  }

  const lead = context.lead as Record<string, unknown> | undefined;
  const ownerId = readString(data, "userId") ?? readString(context.trigger, "workflowOwnerId");
  const responsibleId = readString(lead, "responsibleId");
  const recipientId = data.target === "RESPONSIBLE" ? (responsibleId ?? ownerId) : (ownerId ?? responsibleId);
  if (!recipientId) {
    return { output: { error: "recipient_missing" }, status: "FAILED", errorMessage: "Ninguém para lembrar." };
  }
  if (dryRun) return { output: { recipientId, message }, status: "SUCCESS" };

  const trackingId = readString(lead, "trackingId");
  const organizationId =
    readString(context.trigger, "organizationId") ??
    (trackingId
      ? (await prisma.tracking.findUnique({ where: { id: trackingId }, select: { organizationId: true } }))?.organizationId ?? null
      : null);
  const leadName = readString(lead, "name");
  const conversationUrl = readString(lead, "id") ? `/contatos/${readString(lead, "id")}` : null;
  await dispatchAlert(
    WORKFLOW_REMINDER_EVENT,
    { message, leadName, leadId: readString(lead, "id") },
    {
      bypassRules: {
        title: leadName ? `Lembrete · ${leadName}` : "Lembrete",
        body: message,
        severity: "warning",
        audience: { kind: "user", userIds: [recipientId] },
        orgId: organizationId,
        createdBy: "SYSTEM",
        actionUrl: conversationUrl,
      },
    },
  );
  return { output: { recipientId, message }, status: "SUCCESS" };
};
