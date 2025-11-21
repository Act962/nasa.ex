import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
export const updateStatus = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update a status",
    tags: ["Status"],
  })
  .input(
    z.object({
      name: z.string(),
      color: z.string().optional(),
      statusId: z.string(),
    })
  )
  .output(
    z.object({
      statusName: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const statusExists = await prisma.status.findUnique({
      where: {
        id: input.statusId,
      },
    });

    if (!statusExists) {
      throw errors.NOT_FOUND;
    }

    const status = await prisma.status.update({
      where: {
        id: input.statusId,
      },
      data: {
        name: input.name,
        color: input.color,
      },
    });

    return {
      statusName: status.name,
    };
  });
