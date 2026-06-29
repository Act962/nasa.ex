import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteNotification = base
  .use(requireAdminMiddleware)
  .route({
    method: "DELETE",
    summary: "Admin — Delete notification",
    tags: ["Admin"],
  })
  .input(
    z.object({
      id: z.string().min(1),
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input }) => {
    await prisma.adminNotification.delete({
      where: { id: input.id },
    });

    return { success: true };
  });
