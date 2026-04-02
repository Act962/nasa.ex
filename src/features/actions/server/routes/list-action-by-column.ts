import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const listActionByColumn = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      columnId: z.string(),
      cursor: z.string().nullish(),
      limit: z.number().min(1).max(100).default(50),
      participantIds: z.array(z.string()).optional().default([]),
      tagIds: z.array(z.string()).optional().default([]),
      dueDateFrom: z.coerce.date().nullable().optional(),
      dueDateTo: z.coerce.date().nullable().optional(),
      sortBy: z.enum(["createdAt", "dueDate", "priority", "title"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
      isArchived: z.boolean().optional().default(false),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const limit = input.limit;

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

    const visibilityFilter: Prisma.ActionWhereInput = isMember
      ? {
          OR: [
            { createdBy: context.user.id },
            { participants: { some: { userId: context.user.id } } },
          ],
        }
      : {};

    const filterWhere: Prisma.ActionWhereInput = {
      ...(input.participantIds.length > 0 && {
        participants: { some: { userId: { in: input.participantIds } } },
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
    };

    const orderBy: Prisma.ActionOrderByWithRelationInput = input.sortBy
      ? { [input.sortBy]: input.sortOrder }
      : { order: "asc" };

    const action = await prisma.action.findMany({
      where: {
        columnId: input.columnId,
        isArchived: input.isArchived,
        ...visibilityFilter,
        ...filterWhere,
      },
      take: limit + 1,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      orderBy,
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        startDate: true,
        columnId: true,
        createdBy: true,
        order: true,
        coverImage: true,
        isDone: true,
        priority: true,
        user: {
          select: {
            id: true,
            image: true,
            name: true,
          },
        },
        participants: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
        },
        subActions: {
          select: {
            id: true,
            isDone: true,
          },
        },
        tags: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        createdAt: true,
      },
    });

    let nextCursor: typeof input.cursor | undefined = undefined;
    if (action.length > limit) {
      const nextItem = action.pop();
      nextCursor = nextItem!.id;
    }

    return { action, nextCursor };
  });
