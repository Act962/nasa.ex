import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { BatchPayload } from "@/generated/prisma/internal/prismaNamespace";

export const createTrackingConsultant = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a tracking consultant",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      userIds: z.array(z.string()),
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const { userIds, trackingId } = input;
      const datas = userIds.map((id) => {
        return {
          userId: id,
          trackingId,
          isActive: false,
        };
      });

      const data = await prisma.trackingConsultant.createMany({
        data: userIds.map((id) => {
          return {
            userId: id,
            trackingId,
            isActive: false,
          };
        }),
        skipDuplicates: true,
      });
      return { trackingId };
    } catch (error) {
      console.error("Error creating tracking consultant:", error);
      throw new Error("Failed to create tracking consultant");
    }
  });
