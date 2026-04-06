import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";

export const getActiveTimer = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const activeTimer = await prisma.actionTimer.findFirst({
      where: {
        userId,
        stoppedAt: null,
      },
      include: {
        action: {
          select: {
            id: true,
            title: true,
            workspaceId: true,
          },
        },
      },
    });

    if (!activeTimer) {
      return { activeTimer: null, accumulatedSeconds: 0 };
    }

    const pastTimers = await prisma.actionTimer.aggregate({
      where: {
        actionId: activeTimer.actionId,
        stoppedAt: { not: null },
      },
      _sum: {
        duration: true,
      },
    });

    return {
      activeTimer,
      accumulatedSeconds: pastTimers._sum.duration || 0,
    };
  });


