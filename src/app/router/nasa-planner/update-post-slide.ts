import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

export const updatePostSlide = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      slideId: z.string(),
      imageKey: z.string().optional(),
      headline: z.string().optional().nullable(),
      subtext: z.string().optional().nullable(),
      overlayConfig: z.record(z.string(), z.unknown()).optional(),
      targetFormat: z.enum(["1:1", "9:16", "4:5", "1.91:1"]).optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const slide = await prisma.nasaPlannerPostSlide.findFirst({
      where: { id: input.slideId },
      include: { post: { select: { organizationId: true, id: true } } },
    });
    if (!slide) throw new ORPCError("NOT_FOUND", { message: "Slide não encontrado" });
    if (slide.post.organizationId !== context.org.id) throw new ORPCError("FORBIDDEN");

    const updated = await prisma.nasaPlannerPostSlide.update({
      where: { id: input.slideId },
      data: {
        ...(input.imageKey !== undefined && { imageKey: input.imageKey }),
        ...(input.headline !== undefined && { headline: input.headline }),
        ...(input.subtext !== undefined && { subtext: input.subtext }),
        ...(input.overlayConfig !== undefined && { overlayConfig: input.overlayConfig as any }),
        ...(input.targetFormat !== undefined && { targetFormat: input.targetFormat }),
      },
    });

    // Keep thumbnail in sync when first slide image changes
    if (input.imageKey && slide.order === 1) {
      await prisma.nasaPlannerPost.update({
        where: { id: slide.post.id },
        data: { thumbnail: input.imageKey },
      });
    }

    return { slide: updated };
  });
