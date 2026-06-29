import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ORPCError } from "@orpc/server";
import {
  computeSetupProgress,
  getRequiredSetupStepForLesson,
  trackHasGatedLessons,
} from "../utils";

export const getTrack = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ slug: z.string() }))
  .handler(async ({ input, context }) => {
    const track = await prisma.spaceHelpTrack.findUnique({
      where: { slug: input.slug },
      include: {
        lessons: { orderBy: { order: "asc" } },
        rewardBadge: true,
        category: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!track) throw new ORPCError("NOT_FOUND", { message: "Rota não encontrada" });

    const progress = await prisma.spaceHelpProgress.findUnique({
      where: { userId_trackId: { userId: context.user.id, trackId: track.id } },
    });

    // Anota cada aula com o passo do Setup que ela exige (se houver) +
    // se esse passo já foi concluído no banco. Só roda computeSetupProgress
    // se a trilha tem ao menos uma aula com gate.
    const setupProgress = trackHasGatedLessons(track.slug)
      ? await computeSetupProgress({ userId: context.user.id, orgId: context.org.id })
      : null;

    const lessonsWithGate = track.lessons.map((l) => {
      const requiredStepKey = getRequiredSetupStepForLesson(track.slug, l.order);
      const step = requiredStepKey
        ? setupProgress?.steps.find((s) => s.key === requiredStepKey) ?? null
        : null;
      return {
        ...l,
        requiredStepKey,
        requiredStepLabel: step?.label ?? null,
        requiredStepCompleted: step ? step.isCompleted : true,
        requiredStepCtaHref: step?.ctaHref ?? null,
      };
    });

    return {
      track: { ...track, lessons: lessonsWithGate },
      progress: progress
        ? {
            completedLessonIds: progress.completedLessonIds,
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
          }
        : null,
    };
  });
