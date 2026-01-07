import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      workflowId: z.string(),
    })
  )
  .output(
    z.object({
      workflow: z.custom<Workflow>(),
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
        message: "Workflow não encontrado",
      });
    }

    return {
      workflow,
    };
  });
