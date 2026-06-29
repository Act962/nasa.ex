import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { logActivity } from "@/features/admin/lib/activity-logger";
import prisma from "@/lib/prisma";
import { detectCollisions } from "@/features/workflows/lib/collision-detector";
import z from "zod";

export const updateIsActive = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      isActive: z.boolean(),
      /** Quando true, ignora collision warnings (user confirmou conscientemente). */
      ignoreCollisions: z.boolean().optional(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      isActive: z.boolean(),
      collisions: z
        .array(
          z.object({
            workflowId: z.string(),
            workflowName: z.string(),
            conflictType: z.string(),
            description: z.string(),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        nodes: { select: { type: true, data: true } },
        tracking: { select: { name: true, organizationId: true } },
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({ message: "Workflow not found" });
    }

    // Quando ATIVANDO em Modo Agente IA, checa colisão com outros workflows
    // ativos. Retorna warnings — front decide se mostra dialog de confirmação.
    if (
      input.isActive &&
      !input.ignoreCollisions &&
      workflow.agentMode &&
      workflow.tracking?.organizationId
    ) {
      const triggers = workflow.nodes
        .filter((n) =>
          [
            "NEW_LEAD",
            "LEAD_TAGGED",
            "MOVE_LEAD_STATUS",
            "AI_FINISHED",
            "FIRST_CHAT_INTERACTION",
            "FIRST_INTERACTION_OF_DAY",
            "LAST_INBOUND_TIMEOUT",
            "PAYMENT_RECEIVED",
            "MESSAGE_INCOMING",
            "WEBHOOK_EXTERNAL",
          ].includes(n.type),
        )
        .map((n) => ({
          type: n.type,
          data: n.data as Record<string, unknown> | null,
        }));

      const collisions = await detectCollisions({
        workflowId: workflow.id,
        organizationId: workflow.tracking.organizationId,
        trackingId: workflow.trackingId,
        triggers,
      });

      if (collisions.length > 0) {
        // Não bloqueia — devolve as colisões pro UI confirmar.
        return {
          id: workflow.id,
          isActive: workflow.isActive,
          collisions,
        };
      }
    }

    const updated = await prisma.workflow.update({
      where: { id: input.workflowId },
      data: { isActive: input.isActive },
    });

    // Ativou/desativou — invalida o cache do gatilho FIRST_INTERACTION_OF_DAY.
    if (workflow.trackingId) {
      const { invalidateReturningTriggerCache } = await import(
        "@/features/triggers/components/first-interaction-of-day/dispatch"
      );
      invalidateReturningTriggerCache(workflow.trackingId);
    }

    if (
      workflow.tracking?.organizationId &&
      workflow.isActive !== input.isActive
    ) {
      await logActivity({
        organizationId: workflow.tracking.organizationId,
        userId: context.user.id,
        userName: context.user.name,
        userEmail: context.user.email,
        userImage: (context.user as any).image,
        appSlug: "tracking",
        action: input.isActive
          ? "workflow.activated"
          : "workflow.deactivated",
        actionLabel: input.isActive
          ? `Ativou a automação "${workflow.name}" no tracking "${workflow.tracking.name}"`
          : `Desativou a automação "${workflow.name}" no tracking "${workflow.tracking.name}"`,
        resource: workflow.name,
        resourceId: workflow.id,
        metadata: {
          trackingName: workflow.tracking.name,
          agentMode: workflow.agentMode,
        },
      });
    }

    return {
      id: updated.id,
      isActive: updated.isActive,
    };
  });
