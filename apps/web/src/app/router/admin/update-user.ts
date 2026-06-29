import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateUser = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Update user", tags: ["Admin"] })
  .input(z.object({
    userId:        z.string(),
    name:          z.string().min(1).max(100).optional(),
    nickname:      z.string().max(50).optional().nullable(),
    isSystemAdmin: z.boolean().optional(),
    isActive:      z.boolean().optional(),
    image:         z.string().url().optional().nullable(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw errors.NOT_FOUND;

    // Prevent self-demotion
    if (input.userId === context.adminUser.id && input.isSystemAdmin === false) {
      throw errors.FORBIDDEN;
    }

    await prisma.user.update({
      where: { id: input.userId },
      data: {
        ...(input.name          !== undefined ? { name: input.name }                   : {}),
        ...(input.nickname      !== undefined ? { nickname: input.nickname }           : {}),
        ...(input.isSystemAdmin !== undefined ? { isSystemAdmin: input.isSystemAdmin } : {}),
        ...(input.isActive      !== undefined ? { isActive: input.isActive }           : {}),
        ...(input.image         !== undefined ? { image: input.image }                 : {}),
      },
    });

    return { success: true };
  });
