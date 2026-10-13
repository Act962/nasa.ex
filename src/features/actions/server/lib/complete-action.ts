import "server-only";
import prisma from "@/lib/prisma";
import { awardPoints } from "@/app/router/space-point/utils";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { hasActionCompletedWorkflow, sendWorkspaceWorkflowEvent } from "@/inngest/utils";

// Concluir uma ação tem os mesmos efeitos na tela e no Astro (spec 0078, RF-10):
// pontos, automação "ação concluída" e registro de atividade. Nada disso roda em transação.

export interface ActionCompletionActor {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface CompletableAction {
  id: string;
  title: string;
  createdBy: string;
  workspaceId: string;
}

export async function runActionCompletedEffects(params: {
  action: CompletableAction;
  organizationId: string;
  actor: ActionCompletionActor;
}) {
  const { action, organizationId, actor } = params;
  await awardPoints(action.createdBy, organizationId, "complete_card", "Card concluído ✅");

  try {
    if (await hasActionCompletedWorkflow(action.workspaceId)) {
      await sendWorkspaceWorkflowEvent({
        trigger: "WS_ACTION_COMPLETED",
        workspaceId: action.workspaceId,
        actionId: action.id,
      });
    }
  } catch (error) {
    console.error("[workspace-workflow] failed to emit action.completed", error);
  }

  await logActivity({
    organizationId,
    userId: actor.id,
    userName: actor.name,
    userEmail: actor.email,
    userImage: actor.image,
    appSlug: "workspace",
    subAppSlug: "workspace-actions",
    featureKey: "workspace.action.completed",
    action: "workspace.action.completed",
    actionLabel: `Concluiu a ação "${action.title}"`,
    resource: action.title,
    resourceId: action.id,
    metadata: { changedFields: ["isDone"] },
  });
}

/**
 * Marca como concluída e devolve a tarefa, ou `null` quando já estava concluída ou não existe.
 * Os efeitos ficam com quem chama: em lote eles rodam depois da resposta, um por vez.
 */
export async function markActionDone(params: {
  actionId: string;
  organizationId: string;
}): Promise<CompletableAction | null> {
  const claimed = await prisma.action.updateMany({
    where: { id: params.actionId, isDone: false, workspace: { organizationId: params.organizationId } },
    data: { isDone: true, closedAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return prisma.action.findUnique({
    where: { id: params.actionId },
    select: { id: true, title: true, createdBy: true, workspaceId: true },
  });
}

/** Efeitos de várias conclusões, em sequência e sem derrubar as demais quando uma falha. */
export async function runCompletedEffectsInSequence(params: {
  actions: CompletableAction[];
  organizationId: string;
  actor: ActionCompletionActor;
}) {
  for (const action of params.actions) {
    await runActionCompletedEffects({ action, organizationId: params.organizationId, actor: params.actor }).catch((error) =>
      console.error("[complete-action] effects_failed", error),
    );
  }
}
