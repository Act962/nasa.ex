import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { PUBLIC_USER_SELECT } from "@/features/space-page/utils/public-selectors";
import { spaceVisibilityGuard } from "./middlewares/visibility-guard";

export const listFollowers = base
  .use(spaceVisibilityGuard)
  .input(
    z.object({
      nick: z.string().min(1),
      cursor: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }),
  )
  .handler(async ({ input, context }) => {
    const rows = await prisma.orgFollow.findMany({
      where: { orgId: context.organization.id },
      orderBy: { createdAt: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        createdAt: true,
        user: { select: PUBLIC_USER_SELECT },
      },
    });

    let nextCursor: string | null = null;
    if (rows.length > input.limit) {
      const next = rows.pop();
      nextCursor = next?.id ?? null;
    }

    return { followers: rows, nextCursor };
  });
