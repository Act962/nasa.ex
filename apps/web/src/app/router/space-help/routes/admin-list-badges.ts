import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { requireModerator } from "../utils";

export const adminListBadges = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    await requireModerator(context.user.id);
    const badges = await prisma.spaceHelpBadge.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { tracks: true, awarded: true } },
      },
    });
    return { badges };
  });
