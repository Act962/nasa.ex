import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const updateTrackingConsultant = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Update a tracking consultant",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      id: z.string(),
      isActive: z.boolean().optional(),
      maxFlow: z.number().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { id, isActive, maxFlow } = input;

      const data = await prisma.trackingConsultant.update({
        where: {
          id: id,
        },
        data: {
          isActive: isActive,
          maxFlow: maxFlow,
        },
      });
      return data;
    } catch (error) {
      console.error("Error creating tracking consultant:", error);
      throw new Error("Failed to create tracking consultant");
    }
  });
