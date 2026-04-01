import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const setSystemAdmin = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Grant or revoke system admin", tags: ["Admin"] })
  .input(z.object({
    userId: z.string(),
    isSystemAdmin: z.boolean(),
  }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    // Prevent self-demotion
    if (input.userId === context.adminUser.id && !input.isSystemAdmin) {
      throw errors.FORBIDDEN;
    }

    const target = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true, isSystemAdmin: true },
    });
    if (!target) throw errors.NOT_FOUND;

    await prisma.user.update({
      where: { id: input.userId },
      data: { isSystemAdmin: input.isSystemAdmin },
    });

    return { success: true };
  });
