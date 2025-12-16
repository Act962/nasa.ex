import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const deleteReason = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      id: z.string(),
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

    await prisma.winLossReason.delete({
      where: {
        id: input.id,
      },
    });
  });
