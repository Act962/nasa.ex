import { dispatchAlert } from "@/features/alerts/lib/alert-engine";
import prisma from "@/lib/prisma";

// Aviso de "nova tarefa" para quem entrou numa demanda: sino + balão do ASTRO.
// Direto ao usuário, sem depender de regra de alerta configurada.

export const NEW_TASK_EVENT = "action.assigned";

export async function notifyNewTask(params: {
  actionId: string;
  title: string;
  workspaceId: string;
  organizationId: string;
  /** Quem colocou a pessoa na demanda — não recebe o próprio aviso. */
  actorId: string;
  actorName?: string | null;
  userIds: string[];
}): Promise<void> {
  const recipientIds = [...new Set(params.userIds)].filter((userId) => userId !== params.actorId);
  if (recipientIds.length === 0) return;

  // Best-effort: falha no aviso não pode desfazer a demanda já gravada.
  try {
    const actorName =
      params.actorName ??
      (await prisma.user.findUnique({ where: { id: params.actorId }, select: { name: true } }))?.name ??
      null;
    await dispatchAlert(
      NEW_TASK_EVENT,
      { actionId: params.actionId, taskTitle: params.title, actorName },
      {
        bypassRules: {
          title: "Nova tarefa para você",
          body: actorName ? `${actorName} colocou você em "${params.title}".` : `Você entrou em "${params.title}".`,
          severity: "info",
          audience: { kind: "user", userIds: recipientIds },
          actionUrl: `/workspaces/${params.workspaceId}?action=${params.actionId}`,
          orgId: params.organizationId,
          createdBy: params.actorId,
        },
      },
    );
  } catch (error) {
    console.error("[actions] aviso de nova tarefa falhou", error);
  }
}
