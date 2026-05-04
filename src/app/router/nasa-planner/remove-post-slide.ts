import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const removePostSlide = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string(), slideId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
      include: { slides: { orderBy: { order: "asc" } } },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const slide = post.slides.find((s) => s.id === input.slideId);
    if (!slide) throw new ORPCError("NOT_FOUND", { message: "Slide não encontrado" });

    await prisma.nasaPlannerPostSlide.delete({ where: { id: input.slideId } });

    // Reorder remaining slides
    const remaining = post.slides.filter((s) => s.id !== input.slideId);
    for (let i = 0; i < remaining.length; i++) {
      await prisma.nasaPlannerPostSlide.update({
        where: { id: remaining[i].id },
        data: { order: i + 1 },
      });
    }

    // Update thumbnail to first remaining slide, or null if none
    const newThumb = remaining[0]?.imageKey ?? null;
    await prisma.nasaPlannerPost.update({
      where: { id: input.postId },
      data: { thumbnail: newThumb },
    });

    return { success: true };
  });
