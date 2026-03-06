import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const getMany = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/list-status",
    summary: "List status only",
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const result = await prisma.status.findMany({
      where: {
        trackingId: input.trackingId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
        _count: {
          select: {
            leads: true,
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    });

    const status = result.map((s) => ({
      id: s.id,
      name: s.name,
      color: s.color,
      order: s.order.toString(),
      leads: s._count.leads,
    }));

    return status;
  });
