import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

export const listPosts = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(30).default(10),
    }),
  )
  .handler(async ({ input, context }) => {
    const posts = await prisma.companyPost.findMany({
      where: { orgId: context.organization.id, isPublished: true },
      orderBy: { publishedAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverUrl: true,
        publishedAt: true,
        viewCount: true,
        author: { select: PUBLIC_USER_SELECT },
      },
    });

    let nextCursor: string | null = null;
    if (posts.length > input.limit) {
      const next = posts.pop();
      nextCursor = next?.id ?? null;
    }

    return { posts, nextCursor };
  });
