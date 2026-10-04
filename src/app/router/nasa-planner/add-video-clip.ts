import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { assertPostAccess } from "@/features/nasa-planner/server/cross-org";
import { reopenPostAfterEdit } from "@/features/nasa-planner/server/approval";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const addVideoClip = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      postId: z.string(),
      videoKey: z.string(),
      order: z.number().int().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { post: accessiblePost } = await assertPostAccess(context.user.id, input.postId, "create");
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: accessiblePost.organizationId },
      include: { slides: { orderBy: { order: "desc" }, take: 1 } },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const nextOrder = input.order ?? ((post.slides[0]?.order ?? 0) + 1);

    const slide = await prisma.nasaPlannerPostSlide.create({
      data: {
        postId: input.postId,
        videoKey: input.videoKey,
        order: nextOrder,
      },
    });

    await reopenPostAfterEdit(input.postId, context.user.id);
    return { slide };
  });
