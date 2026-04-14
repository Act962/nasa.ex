import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const markNotificationRead = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Mark notification as read" })
  .input(z.object({ notificationId: z.string() }))
  .handler(async ({ input, context }) => {
    const userId = context.user.id;
    await prisma.adminNotificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId: input.notificationId,
          userId,
        },
      },
      create: {
        notificationId: input.notificationId,
        userId,
      },
      update: {},
    });
    return { success: true };
  });

export const markAllNotificationsRead = base
  .use(requiredAuthMiddleware)
  .route({ method: "POST", summary: "Mark all notifications as read" })
  .input(z.object({}))
  .output(z.object({ count: z.number() }))
  .handler(async ({ context }) => {
    const userId = context.user.id;

    const userOrgs = await prisma.member
      .findMany({
        where: { userId },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    const unreadNotifs = await prisma.adminNotification.findMany({
      where: {
        OR: [
          { targetType: "all" },
          { targetType: "user", targetId: userId },
          { targetType: "org", targetId: { in: userOrgs } },
        ],
        reads: {
          none: { userId },
        },
      },
      select: { id: true },
    });

    if (unreadNotifs.length === 0) return { count: 0 };

    const result = await prisma.adminNotificationRead.createMany({
      data: unreadNotifs.map((n) => ({
        notificationId: n.id,
        userId,
      })),
      skipDuplicates: true,
    });

    return { count: result.count };
  });
