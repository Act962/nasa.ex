import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { requireModerator } from "../utils";

export const upsertBadge = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string().optional(),
      slug: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      iconUrl: z.string().optional().nullable(),
      color: z.string().optional().nullable(),
      isActive: z.boolean().default(true),
    }),
  )
  .handler(async ({ input, context }) => {
    await requireModerator(context.user.id);
    const { id, ...data } = input;
    if (id) {
      return await prisma.spaceHelpBadge.update({ where: { id }, data });
    }
    return await prisma.spaceHelpBadge.create({ data });
  });
