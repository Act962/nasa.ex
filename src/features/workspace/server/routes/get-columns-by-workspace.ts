import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getColumnsByWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string().min(1, "Workspace é obrigatório"),
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

    const result = await prisma.workspaceColumn.findMany({
      where: {
        workspaceId: input.workspaceId,
      },
      orderBy: {
        order: "asc",
      },
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
        workspaceId: true,
        _count: {
          select: {
            actions: {
              where: {
                isArchived: false,
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
              },
            },
          },
        },
      },
    });

    const columns = result.map((column) => ({
      ...column,
      actionsCount: column._count.actions,
    }));

    return {
      columns,
    };
  });
