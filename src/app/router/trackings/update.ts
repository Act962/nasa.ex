import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";

export const updateTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "PUT",
    summary: "Update a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
      name: z.string(),
      description: z.string().optional(),
    })
  )
  .output(
    z.object({
      trackingName: z.string(),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const trackingExists = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!trackingExists) {
      throw errors.NOT_FOUND;
    }

    const tracking = await prisma.tracking.update({
      where: {
        id: input.trackingId,
      },
      data: {
        name: input.name,
        description: input.description,
      },
    });

    return {
      trackingName: tracking.name,
    };
  });
