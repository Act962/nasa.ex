import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listStatusSimple = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    path: "/list-status",
    summary: "List all status without leads",
    tags: ["Status"],
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
      orderBy: {
        order: "asc",
      },
    });

    return {
      status: status.map((s) => ({
        ...s,
        order: s.order.toString(),
      })),
    };
  });
