import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { dispatchManualTrigger } from "@/inngest/utils";
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

    if (!workflow.isActive) {
      throw errors.BAD_REQUEST({
        message: "Automação está desativada",
      });
    }

    await dispatchManualTrigger({
      workflowId: input.id,
    });

    return workflow;
  });
