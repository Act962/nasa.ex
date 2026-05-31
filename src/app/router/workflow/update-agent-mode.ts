/**
 * Procedure pra ligar/desligar Modo Agente IA num workflow.
 *
 * Quando ligado:
 *  - Permite multi-trigger (UI desabilita o `!hasTriggerInWorkflow`)
 *  - Libera nodes IF_CONDITION, LOOP_OVER, AI_DECISION, etc no NodeSelector
 *  - Engine `executeWorkflow` delega pro `run-workflow.ts` (DAG executor)
 *  - Cycle detector + collision detector rodam no save
 *
 * Pode mudar a qualquer momento. Se ligar e o workflow já tem nodes
 * incompatíveis (ex: ciclo sem IF), o save subsequente vai bloquear até
 * o user ajustar.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateAgentMode = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      agentMode: z.boolean(),
      /** Override do default 60 runs/hora. Cap soft entre 1 e 1000. */
      maxRunsPerHour: z.number().int().min(1).max(1000).optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      agentMode: z.boolean(),
      maxRunsPerHour: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      select: {
        id: true,
        name: true,
        agentMode: true,
        tracking: { select: { name: true, organizationId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow not found" });
    }

    const updated = await prisma.workflow.update({
      where: { id: input.workflowId },
      data: {
        agentMode: input.agentMode,
        ...(input.maxRunsPerHour !== undefined
          ? { maxRunsPerHour: input.maxRunsPerHour }
          : {}),
      },
      select: { id: true, agentMode: true, maxRunsPerHour: true },
    });

    if (
      workflow.tracking?.organizationId &&
      workflow.agentMode !== input.agentMode
    ) {
      await logActivity({
        organizationId: workflow.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: input.agentMode
          ? "workflow.agent_mode_enabled"
          : "workflow.agent_mode_disabled",
        actionLabel: input.agentMode
          ? `Ativou Modo Agente IA na automação "${workflow.name}"`
          : `Desativou Modo Agente IA na automação "${workflow.name}"`,
        resource: workflow.name,
        resourceId: workflow.id,
        metadata: {
          trackingName: workflow.tracking.name,
          maxRunsPerHour: updated.maxRunsPerHour,
        },
      });
    }

    return {
      id: updated.id,
      agentMode: updated.agentMode,
      maxRunsPerHour: updated.maxRunsPerHour,
    };
  });
