import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listUserBadges = base
  .use(requiredAuthMiddleware)
  .input(z.object({ userId: z.string().optional() }).optional())
  .handler(async ({ input, context }) => {
    const userId = input?.userId ?? context.user.id;
    const badges = await prisma.userSpaceHelpBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: "desc" },
      include: {
        badge: true,
        track: { select: { id: true, slug: true, title: true } },
      },
    });
    return { badges };
  });
