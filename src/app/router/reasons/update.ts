import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateReason = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(["WIN", "LOSS"]).optional(),
    })
  )
  .output(
    z.object({
      reasonId: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const reasonExists = await prisma.winLossReason.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!reasonExists) {
      throw errors.BAD_REQUEST;
    }

    const reason = await prisma.winLossReason.update({
      where: {
        id: input.id,
      },
      data: {
        name: input.name,
        type: input.type,
      },
    });

    return {
      reasonId: reason.id,
    };
  });
