import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import { syncPublishGroupContent } from "@/features/nasa-planner/server/publish-group";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const uploadPostImage = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      imageKey: z.string(),
      slideOrder: z.number().int().min(1).default(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const existingSlide = await prisma.nasaPlannerPostSlide.findFirst({
      where: { postId: post.id, order: input.slideOrder },
    });

    if (existingSlide) {
      await prisma.nasaPlannerPostSlide.update({
        where: { id: existingSlide.id },
        data: { imageKey: input.imageKey },
      });
    } else {
      await prisma.nasaPlannerPostSlide.create({
        data: { postId: post.id, order: input.slideOrder, imageKey: input.imageKey, overlayConfig: {} },
      });
    }

    if (input.slideOrder === 1) {
      await prisma.nasaPlannerPost.update({
        where: { id: post.id },
        data: { thumbnail: input.imageKey },
      });
    }

    await reopenPostAfterEdit(input.postId, context.user.id);

    await syncPublishGroupContent(input.postId, context.user.id);
    return { success: true };
  });
