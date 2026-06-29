import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";

export const listTracks = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    const tracks = await prisma.spaceHelpTrack.findMany({
      where: { isPublished: true },
      orderBy: { order: "asc" },
      include: {
        rewardBadge: true,
        _count: { select: { lessons: true } },
        progress: {
          where: { userId: context.user.id },
          take: 1,
        },
      },
    });
    return {
      tracks: tracks.map((t) => ({
        id: t.id,
        slug: t.slug,
        title: t.title,
        subtitle: t.subtitle,
        description: t.description,
        coverUrl: t.coverUrl,
        level: t.level,
        durationMin: t.durationMin,
        rewardStars: t.rewardStars,
        rewardSpacePoints: t.rewardSpacePoints,
        rewardBadge: t.rewardBadge,
        lessonCount: t._count.lessons,
        completedLessonCount: t.progress[0]?.completedLessonIds.length ?? 0,
        completedAt: t.progress[0]?.completedAt ?? null,
      })),
    };
  });
