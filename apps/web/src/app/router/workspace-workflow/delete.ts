import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteWorkspaceWorkflow = base
  .use(requiredAuthMiddleware)
  .input(z.object({ id: z.string() }))
  .handler(async ({ input, errors }) => {
    const wf = await prisma.workflow.findUnique({
      where: { id: input.id },
    });
    if (!wf) throw errors.NOT_FOUND({ message: "Workflow não encontrado" });

    await prisma.workflow.delete({ where: { id: input.id } });
    return wf;
  });
