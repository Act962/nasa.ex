import { meterOrThrow } from "@/features/stars/lib/metering";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { StarTransactionType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

const STARS_MERGE_FFMPEG = 1;

export const saveEditedVideo = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      finalVideoKey: z.string(),
      videoDuration: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const { stars: starsCharged, balanceAfter } = await meterOrThrow({
      organizationId: context.org.id,
      action: "planner_video_merge",
      userId: context.user.id,
      appSlug: "nasa-planner",
      description: "Vídeo editado com FFmpeg",
      feature: "planner.video.merge",
    });

    const updated = await prisma.nasaPlannerPost.update({
      where: { id: input.postId },
      data: {
        videoKey: input.finalVideoKey,
        thumbnail: input.finalVideoKey,
        type: "REEL",
        ...(input.videoDuration !== undefined && { videoDuration: input.videoDuration }),
      },
    });

    return { post: updated, starsSpent: starsCharged, balanceAfter };
  });
