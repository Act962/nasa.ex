import { requireAdminMiddleware } from "@/app/middlewares/admin";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listNotifications = base
  .use(requireAdminMiddleware)
  .route({
    method: "GET",
    summary: "Admin — List notifications",
    tags: ["Admin"],
  })
  .input(
    z.object({
      page: z.coerce.number().int().positive().default(1),
      limit: z.coerce.number().int().positive().max(100).default(25),
    }),
  )
  .output(
    z.object({
      notifications: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string(),
          type: z.string(),
          targetType: z.string(),
          targetId: z.string().nullable(),
          createdBy: z.string(),
          createdAt: z.string(),
          readCount: z.number(),
        }),
      ),
      total: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const { page, limit } = input;
    const [notifications, total] = await Promise.all([
      prisma.adminNotification.findMany({
        where: { createdBy: { not: "SYSTEM" } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          body: true,
          type: true,
          targetType: true,
          targetId: true,
          createdBy: true,
          createdAt: true,
          _count: { select: { reads: true } },
        },
      }),
      prisma.adminNotification.count({
        where: { createdBy: { not: "SYSTEM" } },
      }),
    ]);


    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        targetType: n.targetType,
        targetId: n.targetId ?? null,
        createdBy: n.createdBy,
        createdAt: n.createdAt.toISOString(),
        readCount: n._count.reads,
      })),
      total,
    };
  });
