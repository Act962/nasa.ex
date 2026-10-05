import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const attachVideo = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      videoKey: z.string(),
      videoDuration: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const updated = await prisma.nasaPlannerPost.update({
      where: { id: input.postId },
      data: {
        videoKey: input.videoKey,
        ...(input.videoDuration !== undefined && { videoDuration: input.videoDuration }),
        type: "REEL",
      },
    });

    await reopenPostAfterEdit(input.postId, context.user.id);
    return { post: updated };
  });
