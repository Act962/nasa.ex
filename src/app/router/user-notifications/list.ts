import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listNotifications = base
  .use(requiredAuthMiddleware)
  .route({ method: "GET", summary: "List my notifications" })
  .input(
    z.object({
      unreadOnly: z.boolean().optional().default(false),
      limit: z.coerce.number().int().positive().max(50).default(20),
    }),
  )
  .output(
    z.object({
      notifications: z.array(
        z.object({
          id: z.string(),
          type: z.string(),
          title: z.string(),
          body: z.string(),
          appKey: z.string().nullable(),
          actionUrl: z.string().nullable(),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
      ),
      unreadCount: z.number(),
    }),
  )
  .handler(async ({ input, context }) => {
    const userId = context.user.id;

    // Get user's organizations to filter org-targeted notifications
    const userOrgs = await prisma.member
      .findMany({
        where: { userId },
        select: { organizationId: true },
      })
      .then((members) => members.map((m) => m.organizationId));

    // Visibility logic: broadcast to all, specific to my org, or specific to me
    const visibilityWhere = {
      OR: [
        { targetType: "all" },
        { targetType: "user", targetId: userId },
        { targetType: "org", targetId: { in: userOrgs } },
      ],
    };

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        where: {
          ...visibilityWhere,
          ...(input.unreadOnly ? { reads: { none: { userId } } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          reads: {
            where: { userId },
          },
        },
      }),
      prisma.adminNotification.count({
        where: {
          ...visibilityWhere,
          reads: { none: { userId } },
        },
      }),
    ]);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        appKey: n.appKey ?? null,
        actionUrl: n.actionUrl ?? null,
        isRead: n.reads.length > 0,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
  });

