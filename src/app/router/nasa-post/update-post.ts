import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NasaPostType, NasaPostStatus } from "@/generated/prisma/enums";

export const updatePost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      type: z.nativeEnum(NasaPostType).optional(),
      status: z.nativeEnum(NasaPostStatus).optional(),
      title: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      targetNetworks: z.array(z.string()).optional(),
      thumbnail: z.string().optional(),
      scheduledAt: z.string().optional(),
      slides: z
        .array(
          z.object({
            id: z.string().optional(),
            order: z.number(),
            imageKey: z.string().optional(),
            headline: z.string().optional(),
            subtext: z.string().optional(),
            overlayConfig: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const existing = await prisma.nasaPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!existing) throw new Error("Post não encontrado");

    const post = await prisma.nasaPost.update({
      where: { id: input.postId },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.caption !== undefined && { caption: input.caption }),
        ...(input.hashtags !== undefined && { hashtags: input.hashtags }),
        ...(input.cta !== undefined && { cta: input.cta }),
        ...(input.targetNetworks !== undefined && { targetNetworks: input.targetNetworks }),
        ...(input.thumbnail !== undefined && { thumbnail: input.thumbnail }),
        ...(input.scheduledAt !== undefined && { scheduledAt: new Date(input.scheduledAt) }),
      },
      include: {
        slides: { orderBy: { order: "asc" } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });

    // Replace slides if provided
    if (input.slides !== undefined) {
      await prisma.nasaPostSlide.deleteMany({ where: { postId: input.postId } });
      if (input.slides.length > 0) {
        await prisma.nasaPostSlide.createMany({
          data: input.slides.map((s) => ({
            postId: input.postId,
            order: s.order,
            imageKey: s.imageKey ?? null,
            headline: s.headline ?? null,
            subtext: s.subtext ?? null,
            overlayConfig: (s.overlayConfig ?? {}) as object,
          })),
        });
      }
      return {
        post: await prisma.nasaPost.findUnique({
          where: { id: input.postId },
          include: {
            slides: { orderBy: { order: "asc" } },
            createdBy: { select: { id: true, name: true, image: true } },
          },
        }),
      };
    }

    return { post };
  });
