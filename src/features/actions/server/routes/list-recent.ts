import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { subDays } from "date-fns";
import { z } from "zod";

export const listRecentActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      limit: z.number().optional().default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const sevenDaysAgo = subDays(new Date(), 7);

    const actions = await prisma.action.findMany({
      where: {
        organizationId: context.org.id,
        createdAt: {
          gte: sevenDaysAgo,
        },
        // Garantir que o usuário faz parte dos workspaces das ações
        workspace: {
          members: {
            some: {
              userId: context.user.id,
            },
          },
        },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit,
    });

    return {
      actions,
    };
  });
