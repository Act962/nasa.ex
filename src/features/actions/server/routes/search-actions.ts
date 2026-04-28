import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

export const searchActions = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      search: z.string().optional(),
      columnIds: z.array(z.string()).optional().default([]),
      tagIds: z.array(z.string()).optional().default([]),
      participantIds: z.array(z.string()).optional().default([]),
      limit: z.number().min(1).max(50).optional().default(20),
      isArchived: z.boolean().optional().default(false),
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

    const where: Prisma.ActionWhereInput = {
      workspaceId: input.workspaceId,
      isArchived: input.isArchived,
      ...visibilityFilter,
      ...(input.columnIds.length > 0 && {
        columnId: { in: input.columnIds },
      }),
      ...(input.tagIds.length > 0 && {
        tags: { some: { tagId: { in: input.tagIds } } },
      }),
      ...(input.participantIds.length > 0 && {
        participants: { some: { userId: { in: input.participantIds } } },
      }),
      ...(input.search && {
        title: {
          contains: input.search,
          mode: "insensitive",
        },
      }),
    };

    const actions = await prisma.action.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        title: true,
        column: {
          select: {
            id: true,
            name: true,
            color: true,
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
      },
    });

    return { actions };
  });
