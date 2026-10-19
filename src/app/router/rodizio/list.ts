import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { isAttendanceStateEnabled } from "@/features/org-defaults/lib/attendance/flag";

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
      const tracking = await prisma.tracking.findUnique({
        where: { id: input.trackingId },
        select: { organizationId: true },
      });
      // Estado de atendimento (spec 0113): a carga é de leads não finalizados, sem olhar a IA.
      const isLiveAttendanceState = isAttendanceStateEnabled(tracking?.organizationId);
      const [consultants, leadsCount] = await Promise.all([
        prisma.trackingConsultant.findMany({
          where: {
            trackingId: input.trackingId,
          },
          include: {
            user: true,
          },
          orderBy: {
            user: {
              name: "asc",
            },
          },
        }),

        prisma.lead.groupBy({
          by: ["responsibleId"],
          where: isLiveAttendanceState
            ? { trackingId: input.trackingId, statusFlow: { not: "FINISHED" }, currentAction: "ACTIVE", isArchived: false }
            : { trackingId: input.trackingId, isActive: true, statusFlow: "ACTIVE" },
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
