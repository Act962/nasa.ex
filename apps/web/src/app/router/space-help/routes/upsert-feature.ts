import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const upsertFeature = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      categoryId: z.string(),
      slug: z.string().min(1),
      title: z.string().min(1),
      summary: z.string().optional().nullable(),
      youtubeUrl: z.string().optional().nullable(),
      order: z.number().int().default(0),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const { id, ...data } = input;
    const updatedById = context.user.id;
    if (id) {
      return await prisma.spaceHelpFeature.update({
        where: { id },
        data: { ...data, updatedById },
      });
    }
    return await prisma.spaceHelpFeature.create({ data: { ...data, updatedById } });
  });
