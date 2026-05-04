import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import z from "zod";

export const unreadCountsActionChat = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    path: "/action/chat/unread-counts",
    summary: "Get unread message counts for many actions",
  })
  .input(z.object({ actionIds: z.array(z.string()).max(100) }))
  .handler(async ({ input, context }) => {
    const { actionIds } = input;
    if (actionIds.length === 0) return { counts: {} as Record<string, number> };

    const reads = await prisma.actionChatRead.findMany({
      where: {
        userId: context.user.id,
        actionId: { in: actionIds },
      },
      select: { actionId: true, lastReadAt: true },
    });
    const readMap = new Map(reads.map((r) => [r.actionId, r.lastReadAt]));

    const entries = await Promise.all(
      actionIds.map(async (actionId) => {
        const lastReadAt = readMap.get(actionId);
        const count = await prisma.actionChatMessage.count({
          where: {
            actionId,
            isDeleted: false,
            senderId: { not: context.user.id },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return [actionId, count] as const;
      }),
    );

    const counts: Record<string, number> = {};
    for (const [id, c] of entries) counts[id] = c;

    return { counts };
  });
