import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const createStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a status",
    tags: ["Status"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      trackingId: z.string(),
    }),
  )
  .output(
    z.object({
      trackingId: z.string(),
      statusName: z.string(),
    }),
  )
  .handler(async ({ input }) => {
    const lastStatus = await prisma.status.findFirst({
      where: {
        trackingId: input.trackingId,
      },
      orderBy: {
        order: "desc",
      },
    });

    let newOrder: Decimal;

    newOrder = lastStatus
      ? new Decimal(lastStatus.order).plus(1)
      : new Decimal(0);

    const status = await prisma.status.create({
      data: {
        name: input.name,
        color: input.color,
        trackingId: input.trackingId,
        order: newOrder,
      },
    });

    return {
      statusName: status.name,
      trackingId: status.trackingId,
    };
  });
