import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { requireModerator } from "../utils";

export const adminListTracks = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    await requireModerator(context.user.id);
    const tracks = await prisma.spaceHelpTrack.findMany({
      orderBy: [{ order: "asc" }, { title: "asc" }],
      include: {
        rewardBadge: true,
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { lessons: true, awards: true } },
      },
    });
    return { tracks };
  });
