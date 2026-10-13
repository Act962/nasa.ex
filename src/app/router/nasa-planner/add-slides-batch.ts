import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import { syncPublishGroupContent } from "@/features/nasa-planner/server/publish-group";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const addSlidesBatch = base
  .use(requiredAuthMiddleware)
  .input(z.object({
    postId: z.string(),
    imageKeys: z.array(z.string()).min(1),
  }))
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
      include: { slides: { orderBy: { order: "asc" } } },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const nextOrder = post.slides.length + 1;

    await prisma.nasaPlannerPostSlide.createMany({
      data: input.imageKeys.map((key, i) => ({
        postId: input.postId,
        imageKey: key,
        order: nextOrder + i,
        overlayConfig: {},
      })),
    });

    // Set thumbnail to first slide if post has none
    if (!post.thumbnail) {
      await prisma.nasaPlannerPost.update({
        where: { id: input.postId },
        data: { thumbnail: input.imageKeys[0] },
      });
    }

    await reopenPostAfterEdit(input.postId, context.user.id);

    await syncPublishGroupContent(input.postId, context.user.id);
    return { added: input.imageKeys.length };
  });
