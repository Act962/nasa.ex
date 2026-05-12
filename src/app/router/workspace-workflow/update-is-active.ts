import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateWorkspaceWorkflowIsActive = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      isActive: z.boolean(),
    }),
  )
  .output(
    z.object({
      id: z.string(),
      isActive: z.boolean(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const wf = await prisma.workflow.findUnique({
      where: { id: input.workflowId },
    });
    if (!wf) throw errors.NOT_FOUND({ message: "Workflow not found" });
    if (!wf.workspaceId) {
      throw errors.BAD_REQUEST({
        message: "Workflow não pertence a um workspace",
      });
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
