import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

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
    })
  )
  .output(
    z.object({
      statusName: z.string(),
    })
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

    const order = lastStatus ? lastStatus.order + 1 : 0;

    const status = await prisma.status.create({
      data: {
        name: input.name,
        color: input.color,
        trackingId: input.trackingId,
        order,
      },
    });

    return {
      statusName: status.name,
    };
  });
