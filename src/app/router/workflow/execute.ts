import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import z from "zod";

export const executeWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, errors }) => {
    const workflow = await prisma.workflow.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!workflow) {
      throw errors.NOT_FOUND({
        message: "Workflow não encontrado",
      });
    }

    await inngest.send({
      name: "workflow/execute.workflow",
      data: {
        workflowId: input.id,
      },
    });

    return workflow;
  });
