import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listRecentMembers = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      limit: z.number().optional().default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const members = await prisma.workspaceMember.findMany({
      where: {
        workspace: {
          organizationId: context.org.id,
          members: {
            some: {
                userId: context.user.id,
            }
          }
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit,
    });

    return {
      members,
    };
  });
