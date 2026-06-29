import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteUser = base
  .use(requireAdminMiddleware)
  .route({ method: "POST", summary: "Admin — Delete user", tags: ["Admin"] })
  .input(z.object({ userId: z.string() }))
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    if (input.userId === context.adminUser.id) throw errors.FORBIDDEN;

    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });
    if (!user) throw errors.NOT_FOUND;

    await prisma.user.delete({ where: { id: input.userId } });

    return { success: true };
  });
