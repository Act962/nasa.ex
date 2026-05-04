import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import z from "zod";

export const listReminders = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/reminder/list",
    summary: "List reminders by context",
  })
  .input(
    z.object({
      conversationId: z.string().optional(),
      leadId: z.string().optional(),
      trackingId: z.string().optional(),
      actionId: z.string().optional(),
    }),
  )
  .handler(async ({ input }) => {
    const { conversationId, leadId, trackingId, actionId } = input;

    const reminders = await prisma.reminder.findMany({
      where: {
        isActive: true,
        ...(actionId ? { actionId } : {}),
        ...(conversationId && !actionId ? { conversationId } : {}),
        ...(leadId && !conversationId && !actionId ? { leadId } : {}),
        ...(trackingId && !conversationId && !leadId && !actionId
          ? { trackingId }
          : {}),
      },
      include: {
        occurrences: {
          orderBy: { scheduledAt: "desc" },
          take: 1,
        },
      },
      orderBy: { nextRemindAt: "asc" },
    });

    return { reminders };
  });
