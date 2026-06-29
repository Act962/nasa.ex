import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const upsertCategory = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      slug: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      iconKey: z.string().optional().nullable(),
      appId: z.string().optional().nullable(),
      order: z.number().int().default(0),
      isPublished: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const { id, ...data } = input;
    if (id) {
      return await prisma.spaceHelpCategory.update({ where: { id }, data });
    }
    return await prisma.spaceHelpCategory.create({ data });
  });
