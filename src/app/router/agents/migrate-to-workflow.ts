/**
 * Procedure oRPC pra migrar um Agent.spec (texto livre) → Workflow visual.
 *
 * Frontend: botão "Abrir editor visual" no Agent Card. Cria um Workflow
 * novo com `agentMode=true`, vincula via `Agent.workflowId`/`Workflow.agentId`,
 * e devolve o ID pra redirecionar pro canvas.
 */
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { convertSpecToWorkflow } from "@/features/workflows/lib/convert-spec-to-workflow";
import z from "zod";

export const migrateAgentToWorkflow = base
  .use(requiredAuthMiddleware)
  .input(z.object({ agentId: z.string() }))
  .handler(async ({ input, errors }) => {
    const agent = await prisma.agent.findUnique({
      where: { id: input.agentId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        trackingId: true,
        spec: true,
        systemInstructions: true,
      },
    });

    if (!agent) {
      throw errors.NOT_FOUND({ message: "Agent não encontrado" });
    }

    const result = await convertSpecToWorkflow(prisma, {
      agentId: agent.id,
      organizationId: agent.organizationId,
      trackingId: agent.trackingId,
      agentName: agent.name,
      spec: agent.spec,
      systemInstructions: agent.systemInstructions,
    });

    return result;
  });
