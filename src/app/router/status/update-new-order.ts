import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const updateNewOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    summary: "Update status order position",
    tags: ["Status"],
  })
  .input(
    z.object({
      id: z.string(),
      order: z.string(),
    }),
  )

  .handler(async ({ input, errors }) => {
    console.log(input);

    const status = await prisma.status.findUnique({
      where: {
        id: input.id,
      },
    });

    if (!status) {
      throw errors.NOT_FOUND({
        message: "Status not found",
      });
    }

    const statusUpdated = await prisma.status.update({
      where: {
        id: input.id,
      },
      data: {
        order: Prisma.Decimal(input.order),
      },
    });

    return {
      success: true,
      status: statusUpdated,
    };
  });
