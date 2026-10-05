import { meterOrThrow } from "@/features/stars/lib/metering";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import { StarTransactionType } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

const STARS_MERGE_FFMPEG = 1;

export const saveEditedVideo = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      finalVideoKey: z.string(),
      videoDuration: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const { stars: starsCharged, balanceAfter } = await meterOrThrow({
      organizationId: accessiblePost.organizationId,
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

    await reopenPostAfterEdit(input.postId, context.user.id);
    return { post: updated, starsSpent: starsCharged, balanceAfter };
  });
