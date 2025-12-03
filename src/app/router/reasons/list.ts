import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const listReasons = base
  .use(requiredAuthMiddleware)
  .route({
    method: "GET",
    summary: "List reasons",
    tags: ["Reasons"],
  })
  .input(
    z.object({
      type: z.enum(["WIN", "LOSS"]),
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      reasons: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(["WIN", "LOSS"]),
        })
      ),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const reasons = await prisma.winLossReason.findMany({
      select: {
        id: true,
        name: true,
        type: true,
      },
      where: {
        trackingId: input.trackingId,
        type: input.type,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return {
      reasons,
    };
  });
