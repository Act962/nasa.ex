import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const removePostMedia = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({
    postId: z.string(),
    type: z.enum(["image", "video"]),
  }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
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

    return { success: true };
  });
