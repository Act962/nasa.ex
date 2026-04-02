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
      participantIds: z.array(z.string()).optional().default([]),
      tagIds: z.array(z.string()).optional().default([]),
      dueDateFrom: z.coerce.date().nullable().optional(),
      dueDateTo: z.coerce.date().nullable().optional(),
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
                ...(input.participantIds.length > 0 && {
                  participants: {
                    some: { userId: { in: input.participantIds } },
                  },
                }),
                ...(input.tagIds.length > 0 && {
                  tags: { some: { tagId: { in: input.tagIds } } },
                }),
                ...((input.dueDateFrom || input.dueDateTo) && {
                  dueDate: {
                    ...(input.dueDateFrom && { gte: input.dueDateFrom }),
                    ...(input.dueDateTo && { lte: input.dueDateTo }),
                  },
                }),
                ...(isMember
                  ? {
                      OR: [
                        { createdBy: context.user.id },
                        {
                          participants: {
                            some: { userId: context.user.id },
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
