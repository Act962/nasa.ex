import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

/**
 * Reviews aprovadas de uma empresa. Nunca retorna ip_hash ou
 * fingerprint (§7.2). Reviews `PENDING`/`HIDDEN` ficam invisíveis.
 */
export const listReviews = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const [reviews, agg] = await Promise.all([
      prisma.companyReview.findMany({
        where: { orgId: context.organization.id, status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          verified: true,
          authorName: true,
          createdAt: true,
          author: { select: PUBLIC_USER_SELECT },
        },
      }),
      prisma.companyReview.aggregate({
        where: { orgId: context.organization.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    let nextCursor: string | null = null;
    if (reviews.length > input.limit) {
      const next = reviews.pop();
      nextCursor = next?.id ?? null;
    }

    return {
      reviews,
      nextCursor,
      summary: {
        averageRating: agg._avg.rating ?? 0,
        totalApproved: agg._count._all,
      },
    };
  });
