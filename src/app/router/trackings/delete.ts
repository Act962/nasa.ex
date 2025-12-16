import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";

export const deleteTracking = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    const result = await prisma.tracking.delete({
      where: {
        id: input.trackingId,
      },
    });

    return {
      trackingName: result.name,
    };
  });
