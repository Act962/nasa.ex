import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listWorkspaceWorkflows = base
  .use(requiredAuthMiddleware)
  .input(z.object({ workspaceId: z.string() }))
  .output(z.object({ workflows: z.array(z.custom<Workflow>()) }))
  .handler(async ({ input, errors }) => {
    const ws = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
    });
    if (!ws) throw errors.NOT_FOUND({ message: "Workspace não encontrado" });

    const workflows = await prisma.workflow.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return { workflows };
  });
