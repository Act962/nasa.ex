import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const listUsersWithoutConsultants = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "List users without consultants",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const usersWithoutConsultant = await prisma.trackingParticipant.findMany({
        where: {
          trackingId: input.trackingId,
          user: {
            trackingConsultants: {
              none: {
                trackingId: input.trackingId,
              },
            },
          },
        },
        include: {
          user: true,
        },
      });
      return { usersWithoutConsultant };
    } catch (error) {
      console.error("Error creating tracking consultant:", error);
      throw new Error("Failed to create tracking consultant");
    }
  });
