import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { Connection, Node, Workflow } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";

export type WorkflowWithGraph = Workflow & {
  nodes: Node[];
  connections: Connection[];
};

export const listWorkspaceWorkflows = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ workspaceId: z.string() }))
  .output(z.object({ workflows: z.array(z.custom<WorkflowWithGraph>()) }))
  .handler(async ({ input, context, errors }) => {
    const ws = await prisma.workspace.findUnique({
      where: {
        id: input.workspaceId,
        organizationId: context.org.id,
      },
    });
    if (!ws) throw errors.NOT_FOUND({ message: "Workspace não encontrado" });

    const workflows = await prisma.workflow.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { nodes: true, connections: true },
    });

    return { workflows };
  });
