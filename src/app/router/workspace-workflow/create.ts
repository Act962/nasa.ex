import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { NodeType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createWorkspaceWorkflow = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      workspaceId: z.string(),
    }),
  )
  .handler(async ({ context, input, errors }) => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
    });

    if (!workspace) {
      throw errors.BAD_REQUEST({ message: "Workspace não encontrado" });
    }

    const workflow = await prisma.workflow.create({
      data: {
        name: input.name,
        description: input.description,
        workspaceId: input.workspaceId,
        userId: context.user.id,
        nodes: {
          create: {
            type: NodeType.WS_INITIAL,
            position: { x: 0, y: 0 },
            name: NodeType.WS_INITIAL,
          },
        },
      },
    });

    return {
      id: workflow.id,
      workspaceId: workflow.workspaceId,
      name: workflow.name,
    };
  });
