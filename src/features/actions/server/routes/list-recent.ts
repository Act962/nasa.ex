import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { subDays } from "date-fns";
import dayjs from "dayjs";
import { z } from "zod";

export const listRecentActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      limit: z.number().optional().default(10),
      days: z.number().optional().default(7),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const member = await prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId: context.user.id,
          organizationId: context.org.id,
        },
      },
    });

    if (!member) {
      throw errors.FORBIDDEN;
    }

    const isMember = member.role === "member";

    const sevenDaysAgo = dayjs().subtract(input.days, "day").toDate();

    const actions = await prisma.action.findMany({
      where: {
        isArchived: false,
        createdAt: {
          gte: sevenDaysAgo,
        },
        ...(isMember
          ? {
              OR: [
                {
                  createdBy: context.user.id,
                },
                {
                  participants: {
                    some: {
                      userId: context.user.id,
                    },
                  },
                },
              ],
            }
          : {}),
        workspace: {
          organizationId: context.org.id,
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
