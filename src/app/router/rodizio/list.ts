import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { canAccessTracking } from "@/features/workflows/server/workflow-access";
import { ORPCError } from "@orpc/server";
import { consultantLoadFilter } from "@/features/org-defaults/lib/attendance/rodizio";

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
    if (!(await canAccessTracking(input.trackingId, context.user.id))) {
      throw new ORPCError("NOT_FOUND", { message: "Funil não encontrado" });
    }
    try {
      const tracking = await prisma.tracking.findUnique({
        where: { id: input.trackingId },
        select: { organizationId: true },
      });
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
          // Estado de atendimento (spec 0113): mesma carga que o Rodízio usa para distribuir.
          where: consultantLoadFilter({ organizationId: tracking?.organizationId ?? "", trackingId: input.trackingId }),
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
