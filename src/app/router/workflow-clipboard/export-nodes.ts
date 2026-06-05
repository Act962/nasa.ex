/**
 * Exporta uma seleção parcial de nodes (multi-select no canvas) como
 * BlueprintV2 kind="node-selection". Edges entre nodes não-selecionados
 * são descartadas.
 */
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { serializeNodeSelection } from "@/features/workflow-clipboard/lib/serialize";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const exportNodes = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      nodeIds: z.array(z.string()).min(1),
    }),
  )
  .handler(async ({ input, context, errors }) => {
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

    const result = await serializeNodeSelection(prisma, {
      workflowId: input.workflowId,
      nodeIds: input.nodeIds,
      organizationId: context.org.id,
    });

    return result;
  });
