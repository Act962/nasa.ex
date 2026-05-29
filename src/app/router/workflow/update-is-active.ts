import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
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
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      include: {
        nodes: { select: { type: true, data: true } },
        tracking: { select: { organizationId: true } },
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

    return {
      id: updated.id,
      isActive: updated.isActive,
    };
  });
