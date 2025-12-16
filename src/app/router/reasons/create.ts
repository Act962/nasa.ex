import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const createReason = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      name: z.string(),
      type: z.enum(["WIN", "LOSS"]),
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      reasonId: z.string(),
    })
  )
  .handler(async ({ input }) => {
    const reason = await prisma.winLossReason.create({
      data: {
        name: input.name,
        type: input.type,
        trackingId: input.trackingId,
      },
    });

    return {
      reasonId: reason.id,
    };
  });
