import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { logActivity } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  awardTrackRewards,
  computeSetupProgress,
  getRequiredSetupStepForLesson,
} from "../utils";

export const markLessonComplete = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ trackId: z.string(), lessonId: z.string() }))
  .handler(async ({ input, context }) => {
    const { trackId, lessonId } = input;
    const userId = context.user.id;
    const orgId = context.org.id;

    const track = await prisma.spaceHelpTrack.findUnique({
      where: { id: trackId },
      include: {
        lessons: { select: { id: true, order: true } },
      },
    });
    if (!track) throw new ORPCError("NOT_FOUND", { message: "Rota não encontrada" });

    const lesson = track.lessons.find((l) => l.id === lessonId);
    if (!lesson)
      throw new ORPCError("NOT_FOUND", { message: "Aula não pertence a esta trilha" });

    // Gate: na trilha "Setup Inicial NASA", a aula só pode ser concluída
    // quando o passo correspondente do Setup já estiver feito no banco.
    const requiredStep = getRequiredSetupStepForLesson(track.slug, lesson.order);
    if (requiredStep) {
      const progress = await computeSetupProgress({ userId, orgId });
      const step = progress.steps.find((s) => s.key === requiredStep);
      if (!step?.isCompleted) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Conclua antes o passo: "${step?.label ?? requiredStep}" no Setup Inicial.`,
        });
      }
    }

    const progress = await prisma.spaceHelpProgress.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: {
        userId,
        trackId,
        completedLessonIds: [lessonId],
      },
      update: {},
    });

    let updatedIds = progress.completedLessonIds;
    if (!updatedIds.includes(lessonId)) {
      updatedIds = [...updatedIds, lessonId];
      await prisma.spaceHelpProgress.update({
        where: { id: progress.id },
        data: { completedLessonIds: updatedIds },
      });
    }

    const totalLessons = track.lessons.length;
    const isFullyComplete = updatedIds.length >= totalLessons;

    let rewards = null as null | Awaited<ReturnType<typeof awardTrackRewards>>;
    const justCompleted = isFullyComplete && !progress.completedAt;
    if (justCompleted) {
      await prisma.spaceHelpProgress.update({
        where: { id: progress.id },
        data: { completedAt: new Date() },
      });
      rewards = await awardTrackRewards({ userId, orgId, trackId });
    }

    await logActivity({
      organizationId: orgId,
      userId,
      userName: context.user.name,
      userEmail: context.user.email,
      userImage: (context.user as any).image,
      appSlug: "space-help",
      subAppSlug: "spacehelp-tracks",
      featureKey: justCompleted ? "spacehelp.track.completed" : "spacehelp.lesson.completed",
      action: justCompleted ? "spacehelp.track.completed" : "spacehelp.lesson.completed",
      actionLabel: justCompleted
        ? `Concluiu a trilha "${track.title}" no Space Help`
        : `Concluiu uma aula da trilha "${track.title}"`,
      resource: track.title,
      resourceId: trackId,
      metadata: {
        lessonId,
        completedCount: updatedIds.length,
        totalLessons,
        rewardsApplied: !!rewards,
      },
    });

    return {
      completedLessonIds: updatedIds,
      isFullyComplete,
      rewards,
    };
  });
