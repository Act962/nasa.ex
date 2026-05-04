import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const addSlidesBatch = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    postId: z.string(),
    imageKeys: z.array(z.string()).min(1),
  }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
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

    return { added: input.imageKeys.length };
  });
