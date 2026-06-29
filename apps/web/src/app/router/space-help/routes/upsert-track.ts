import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const upsertTrack = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      slug: z.string().min(1),
      title: z.string().min(1),
      subtitle: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      coverUrl: z.string().optional().nullable(),
      level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      durationMin: z.number().int().optional().nullable(),
      categoryId: z.string().optional().nullable(),
      rewardStars: z.number().int().min(0).default(0),
      rewardSpacePoints: z.number().int().min(0).default(0),
      rewardBadgeId: z.string().optional().nullable(),
      order: z.number().int().default(0),
      isPublished: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const { id, ...data } = input;
    if (id) {
      return await prisma.spaceHelpTrack.update({ where: { id }, data });
    }
    return await prisma.spaceHelpTrack.create({ data });
  });
