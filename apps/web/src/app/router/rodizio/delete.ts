import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const deleteTrackingConsultant = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Delete tracking consultant",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      id: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      await prisma.trackingConsultant.delete({
        where: {
          id: input.id,
        },
      });
    } catch (error) {
      console.error("Error deleting tracking consultant:", error);
      throw new Error("Failed to delete tracking consultant");
    }
  });
