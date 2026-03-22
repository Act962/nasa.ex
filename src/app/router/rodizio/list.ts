import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const listTrackingConsultants = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "List tracking consultants",
    tags: ["Tracking Consultant"],
  })
  .input(
    z.object({
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, context }) => {
    try {
      const [consultants, leadsCount] = await Promise.all([
        prisma.trackingConsultant.findMany({
          where: {
            trackingId: input.trackingId,
          },
          include: {
            user: true,
          },
        }),

        prisma.lead.groupBy({
          by: ["responsibleId"],
          where: {
            trackingId: input.trackingId,
            isActive: true,
            statusFlow: "ACTIVE",
          },
          _count: {
            _all: true,
          },
        }),
      ]);

      const formatted = consultants.map((consultant) => {
        const count = leadsCount.find(
          (l) => l.responsibleId === consultant.userId,
        );

        return {
          ...consultant,
          currentFlow: count?._count._all || 0,
        };
      });

      return {
        consultants: formatted,
      };
    } catch (error) {
      console.error("Error creating tracking consultant:", error);
      throw new Error("Failed to create tracking consultant");
    }
  });
