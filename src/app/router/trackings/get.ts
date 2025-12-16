import prisma from "@/lib/prisma";
import { z } from "zod";
import { base } from "../../middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { requireOrgMiddleware } from "../../middlewares/org";

export const getTracking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({
    method: "GET",
    summary: "Get a tracking",
    tags: ["Trackings"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    })
  )
  .output(
    z.object({
      tracking: z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.date(),
        updatedAt: z.date(),
        organizationId: z.string(),
        description: z.string().nullable(),
      }),
    })
  )
  .handler(async ({ input, errors }) => {
    const tracking = await prisma.tracking.findUnique({
      where: {
        id: input.trackingId,
      },
    });

    if (!tracking) {
      throw errors.NOT_FOUND;
    }

    return {
      tracking: tracking,
    };
  });
