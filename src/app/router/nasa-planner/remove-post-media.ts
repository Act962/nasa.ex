import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import { syncPublishGroupContent } from "@/features/nasa-planner/server/publish-group";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const removePostMedia = base
  .use(requiredAuthMiddleware)
  .input(z.object({
    postId: z.string(),
    type: z.enum(["image", "video"]),
  }))
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    if (input.type === "image") {
      await prisma.nasaPlannerPost.update({
        where: { id: input.postId },
        data: { thumbnail: null },
      });
      // Remove slide 1 image key but keep slide
      await prisma.nasaPlannerPostSlide.updateMany({
        where: { postId: input.postId, order: 1 },
        data: { imageKey: null as any },
      });
    } else {
      await prisma.nasaPlannerPost.update({
        where: { id: input.postId },
        data: { videoKey: null as any, videoDuration: null as any },
      });
    }

    await reopenPostAfterEdit(input.postId, context.user.id);

    await syncPublishGroupContent(input.postId, context.user.id);
    return { success: true };
  });
