import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const createTrackingConsultant = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a tracking consultant",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      userId: z.string(),
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { userId, trackingId } = input;

      const data = await prisma.trackingConsultant.create({
        data: {
          isActive: false,
          trackingId: trackingId,
          userId: userId,
        },
      });
      return data;
    } catch (error) {
      console.error("Error creating tracking consultant:", error);
      throw new Error("Failed to create tracking consultant");
    }
  });
