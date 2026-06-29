import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listReminderOccurrences = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/reminder/occurrences",
    summary: "List sent occurrences for a reminder",
  })
  .input(
    z.object({
      reminderId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const occurrences = await prisma.reminderOccurrence.findMany({
      where: {
        reminderId: input.reminderId,
      },
      orderBy: { scheduledAt: "desc" },
    });

    return { occurrences };
  });
