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
    const status = await prisma.status.findMany({
      where: {
        trackingId: input.trackingId,
      },
      select: {
        id: true,
        name: true,
        color: true,
        order: true,
      },
      orderBy: {
        order: "asc",
      },
    });

    const ordered = status.map((s) => ({
      ...s,
      order: s.order.toString(),
    }));

    return ordered;
  });
