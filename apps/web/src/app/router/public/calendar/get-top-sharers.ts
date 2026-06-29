import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getTopSharers = base
  .input(z.object({ slug: z.string().optional(), limit: z.number().int().min(1).max(20).default(5) }))
  .handler(async ({ input }) => {
    let actionId: string | undefined;
    if (input.slug) {
      const event = await prisma.action.findFirst({
        where: { publicSlug: input.slug, isPublic: true },
        select: { id: true },
      });
      actionId = event?.id;
    }

    const grouped = await prisma.publicActionShare.groupBy({
      by: ["sharerUserId"],
      where: {
        ...(actionId ? { actionId } : {}),
        sharerUserId: { not: null },
      },
      _sum: { clicks: true },
      _count: { _all: true },
      orderBy: { _sum: { clicks: "desc" } },
      take: input.limit,
    });

    const userIds = grouped.map((g) => g.sharerUserId).filter((id): id is string => !!id);
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, image: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      sharers: grouped
        .map((g) => ({
          user: g.sharerUserId ? userMap.get(g.sharerUserId) ?? null : null,
          clicks: g._sum.clicks ?? 0,
          shares: g._count._all,
        }))
        .filter((r) => r.user !== null),
    };
  });
