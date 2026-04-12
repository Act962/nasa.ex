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
      orgProjectId: z.string().optional(),
      clientOrgName: z.string().optional(),
      campaignId: z.string().optional(),
      referenceLinks: z.array(z.string()).optional(),
      scheduledAt: z.string().optional(),
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
        orgProjectId: input.orgProjectId ?? null,
        clientOrgName: input.clientOrgName ?? null,
        campaignId: input.campaignId ?? null,
        referenceLinks: input.referenceLinks ?? [],
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      },
      include: { slides: true },
    });

    return { post };
  });
