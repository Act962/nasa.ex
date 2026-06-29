/**
 * Exporta um workflow completo como BlueprintV2 — pronto pra ir pro
 * clipboard do browser ou download como JSON.
 */
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { serializeFullWorkflow } from "@/features/workflow-clipboard/lib/serialize";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const exportWorkflow = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workflowId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    // Valida ownership: workflow precisa ser da org ativa
    const wf = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
      select: {
        id: true,
        tracking: { select: { organizationId: true } },
      },
    });
    if (!wf) throw errors.NOT_FOUND({ message: "workflow_not_found" });
    if (wf.tracking?.organizationId !== context.org.id) {
      throw errors.FORBIDDEN({
        message: "workflow não pertence à organização ativa",
      });
    }

    const result = await serializeFullWorkflow(prisma, {
      workflowId: input.workflowId,
      organizationId: context.org.id,
    });

    return result;
  });
