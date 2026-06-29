import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { requireModerator } from "../utils";

export const adminStats = base
  .use(requiredAuthMiddleware)
  .handler(async ({ context }) => {
    await requireModerator(context.user.id);

    const [
      categoriesCount,
      categoriesPublishedCount,
      featuresCount,
      stepsCount,
      tracksCount,
      tracksPublishedCount,
      lessonsCount,
      badgesCount,
      badgesActiveCount,
      awardsCount,
    ] = await Promise.all([
      prisma.spaceHelpCategory.count(),
      prisma.spaceHelpCategory.count({ where: { isPublished: true } }),
      prisma.spaceHelpFeature.count(),
      prisma.spaceHelpStep.count(),
      prisma.spaceHelpTrack.count(),
      prisma.spaceHelpTrack.count({ where: { isPublished: true } }),
      prisma.spaceHelpLesson.count(),
      prisma.spaceHelpBadge.count(),
      prisma.spaceHelpBadge.count({ where: { isActive: true } }),
      prisma.userSpaceHelpBadge.count(),
    ]);

    const featuresWithoutVideo = await prisma.spaceHelpFeature.count({
      where: { OR: [{ youtubeUrl: null }, { youtubeUrl: "" }] },
    });
    const stepsWithoutScreenshot = await prisma.spaceHelpStep.count({
      where: { OR: [{ screenshotUrl: null }, { screenshotUrl: "" }] },
    });

    return {
      categories: { total: categoriesCount, published: categoriesPublishedCount },
      features: { total: featuresCount, withoutVideo: featuresWithoutVideo },
      steps: { total: stepsCount, withoutScreenshot: stepsWithoutScreenshot },
      tracks: { total: tracksCount, published: tracksPublishedCount },
      lessons: { total: lessonsCount },
      badges: { total: badgesCount, active: badgesActiveCount, awarded: awardsCount },
    };
  });
