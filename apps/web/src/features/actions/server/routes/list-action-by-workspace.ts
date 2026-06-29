import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const listActionByWorkspace = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      page: z.number().optional().default(1),
      limit: z.number().optional().default(20),
      participantIds: z.array(z.string()).optional().default([]),
      tagIds: z.array(z.string()).optional().default([]),
      projectIds: z.array(z.string()).optional().default([]),
      dueDateFrom: z.coerce.date().nullable().optional(),
      dueDateTo: z.coerce.date().nullable().optional(),
      sortBy: z
        .enum(["order", "createdAt", "dueDate", "priority", "title"])
        .optional()
        .default("order"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("asc"),
      isArchived: z.boolean().optional().default(false),
      isFavorited: z.boolean().optional(),
      title: z.string().optional(),
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
      ...(input.projectIds.length > 0 && {
        orgProjectId: { in: input.projectIds },
      }),
      ...((input.dueDateFrom || input.dueDateTo) && {
        dueDate: {
          ...(input.dueDateFrom && { gte: input.dueDateFrom }),
          ...(input.dueDateTo && { lte: input.dueDateTo }),
        },
      }),
      ...(input.title && {
        title: {
          contains: input.title,
          mode: "insensitive",
        },
      }),
    };

    const orderBy = {
      [input.sortBy]: input.sortOrder,
    } as Prisma.ActionOrderByWithRelationInput;

    const where: Prisma.ActionWhereInput = {
      workspaceId: input.workspaceId,
      isArchived: input.isArchived,
      ...(input.isFavorited !== undefined && { isFavorited: input.isFavorited }),
      ...visibilityFilter,
      ...filterWhere,
    };

    const [actions, total] = await Promise.all([
      prisma.action.findMany({
        where,
        orderBy,
        take: input.limit,
        skip: Math.max(0, (input.page - 1) * input.limit),
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          startDate: true,
          columnId: true,
          createdBy: true,
          priority: true,
          isDone: true,
          isArchived: true,
          isFavorited: true,
          workspaceId: true,
          favorites: {
            where: { userId: context.user.id },
            select: { id: true },
            take: 1,
          },
          column: {
            select: {
              id: true,
              name: true,
              color: true,
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
          createdAt: true,
        },
      }),
      prisma.action.count({ where }),
    ]);

    const lastPage = Math.ceil(total / input.limit);

    const actionsWithFlag = actions.map(({ favorites, ...rest }) => ({
      ...rest,
      isFavoritedByMe: favorites.length > 0,
    }));

    return {
      actions: actionsWithFlag,
      total,
      page: input.page,
      limit: input.limit,
      lastPage,
    };
  });
