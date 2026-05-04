import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

const slideSchema = z.object({
  id: z.string().optional(),
  order: z.number().default(0),
  imageKey: z.string().optional(),
  headline: z.string().optional(),
  subtext: z.string().optional(),
  overlayConfig: z.record(z.string(), z.any()).optional(),
});

export const updatePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      type: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).optional(),
      status: z
        .enum([
          "DRAFT",
          "PENDING_APPROVAL",
          "APPROVED",
          "SCHEDULED",
          "PUBLISHED",
          "FAILED",
        ])
        .optional(),
      title: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      targetNetworks: z.array(z.string()).optional(),
      thumbnail: z.string().optional(),
      scheduledAt: z.string().nullable().optional(),
      slides: z.array(slideSchema).optional(),
      isAd: z.boolean().optional(),
      clientOrgName: z.string().optional(),
      orgProjectId: z.string().nullable().optional(),
      targetIgAccountId: z.string().nullable().optional(),
      targetFbPageId: z.string().nullable().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const { postId, slides, scheduledAt, ...data } = input;

    await prisma.$transaction(async (tx) => {
      await tx.nasaPlannerPost.update({
        where: { id: postId, organizationId: context.org.id },
        data: {
          ...data,
          ...(scheduledAt === null ? { scheduledAt: null } : scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        },
      });

      if (slides !== undefined) {
        await tx.nasaPlannerPostSlide.deleteMany({ where: { postId } });
        if (slides.length > 0) {
          await tx.nasaPlannerPostSlide.createMany({
            data: slides.map((s, i) => ({
              postId,
              order: s.order ?? i,
              imageKey: s.imageKey,
              headline: s.headline,
              subtext: s.subtext,
              overlayConfig: s.overlayConfig ?? {},
            })),
          });
        }
      }
    });

    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: postId, organizationId: context.org.id },
      include: { slides: { orderBy: { order: "asc" } } },
    });

    return { post };
  });
