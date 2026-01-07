import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const updateName = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
      name: z.string(),
    })
  )
  .output(
    z.object({
      id: z.string(),
      workflowName: z.string(),
      trackingId: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: input.workflowId,
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow not found",
      });
    }

    const updatedWorkflow = await prisma.workflow.update({
      where: {
        id: input.workflowId,
      },
      data: {
        name: input.name,
      },
    });

    return {
      id: updatedWorkflow.id,
      workflowName: updatedWorkflow.name,
      trackingId: updatedWorkflow.trackingId,
    };
  });
