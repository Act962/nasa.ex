import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const FAVORITE_SELECT = {
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
  createdAt: true,
  column: { select: { id: true, name: true, color: true } },
  participants: {
    select: {
      user: { select: { id: true, name: true, image: true } },
    },
  },
  subActions: { select: { id: true, isDone: true } },
  tags: {
    select: {
      tag: { select: { id: true, name: true, color: true } },
    },
  },
} satisfies Prisma.ActionSelect;

export const listFavorites = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      workspaceId: z.string(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(30),
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
      select: { role: true },
    });
    if (!member) throw errors.FORBIDDEN({ message: "Sem permissão" });

    const isMember = member.role === "member";
    const visibilityFilter: Prisma.ActionWhereInput = isMember
      ? {
          OR: [
            { createdBy: context.user.id },
            { participants: { some: { userId: context.user.id } } },
          ],
        }
      : {};

    const baseWhere: Prisma.ActionWhereInput = {
      workspaceId: input.workspaceId,
      isArchived: false,
      ...visibilityFilter,
    };

    const [globals, personals] = await Promise.all([
      prisma.action.findMany({
        where: { ...baseWhere, isFavorited: true },
        orderBy: { createdAt: "desc" },
        select: FAVORITE_SELECT,
      }),
      prisma.action.findMany({
        where: {
          ...baseWhere,
          isFavorited: false,
          favorites: { some: { userId: context.user.id } },
        },
        orderBy: { createdAt: "desc" },
        select: FAVORITE_SELECT,
      }),
    ]);

    type Item = (typeof globals)[number] & {
      favoriteKind: "global" | "personal";
      isFavoritedByMe: boolean;
    };

    const personalIds = new Set(personals.map((a) => a.id));
    const items: Item[] = [
      ...globals.map((a) => ({
        ...a,
        favoriteKind: "global" as const,
        isFavoritedByMe: personalIds.has(a.id),
      })),
      ...personals.map((a) => ({
        ...a,
        favoriteKind: "personal" as const,
        isFavoritedByMe: true,
      })),
    ];

    return {
      items,
      total: items.length,
      nextCursor: null as string | null,
    };
  });
