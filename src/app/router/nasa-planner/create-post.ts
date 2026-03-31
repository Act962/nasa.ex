import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createPost = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      plannerId: z.string(),
      type: z.enum(["STATIC", "CAROUSEL", "REEL", "STORY"]).default("STATIC"),
      title: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.create({
      data: {
        plannerId: input.plannerId,
        organizationId: context.org.id,
        createdById: context.user.id,
        type: input.type,
        title: input.title,
      },
      include: { slides: true },
    });

    return { post };
  });
