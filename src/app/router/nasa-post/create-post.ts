import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { NasaPostType } from "@/generated/prisma/enums";

export const createPost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      type: z.nativeEnum(NasaPostType).default(NasaPostType.STATIC),
      title: z.string().optional(),
      caption: z.string().optional(),
      hashtags: z.array(z.string()).optional(),
      cta: z.string().optional(),
      targetNetworks: z.array(z.string()).optional(),
      aiPrompt: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPost.create({
      data: {
        organizationId: context.org.id,
        createdById: context.user.id,
        type: input.type,
        title: input.title ?? null,
        caption: input.caption ?? null,
        hashtags: input.hashtags ?? [],
        cta: input.cta ?? null,
        targetNetworks: input.targetNetworks ?? [],
        aiPrompt: input.aiPrompt ?? null,
      },
      include: {
        slides: true,
        createdBy: { select: { id: true, name: true, image: true } },
      },
    });
    return { post };
  });
