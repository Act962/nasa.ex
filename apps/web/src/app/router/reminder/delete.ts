import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const deleteReminder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    path: "/reminder/delete",
    summary: "Deactivate a reminder",
  })
  .input(z.object({ reminderId: z.string() }))
  .handler(async ({ input, context }) => {
    await prisma.reminder.updateMany({
      where: {
        id: input.reminderId,
        createdByUserId: context.user.id,
      },
      data: { isActive: false },
    });

    return { success: true };
  });
