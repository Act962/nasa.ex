import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const moveAction = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ actionId: z.string(), columnId: z.string(), workspaceId: z.string() }))
  .handler(async ({ input, context }) => {
    const existing = await prisma.action.findUnique({ where: { id: input.actionId }, select: { history: true } });
    const history = (existing?.history as any[]) ?? [];
    const action = await prisma.action.update({
      where: { id: input.actionId },
      data: {
        columnId: input.columnId,
        workspaceId: input.workspaceId,
        history: [...history, { type: "move", userId: context.user.id, timestamp: new Date().toISOString(), to: { columnId: input.columnId, workspaceId: input.workspaceId } }],
      },
    });
    return { action };
  });
