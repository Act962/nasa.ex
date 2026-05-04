import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logActivity } from "@/lib/activity-logger";

// 🟦 UPDATE
export const archiveLead = base
  .route({
    method: "POST",
    path: "/archive/{leadId}",
    summary: "Archive lead",
    tags: ["Leads"],
  })
  .use(requiredAuthMiddleware)
  .input(z.object({ leadId: z.string() }))
  .handler(async ({ input, errors, context }) => {
    try {
      const { id: userId } = context.user;

      const leadExists = await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: {
          id: true,
          name: true,
          statusId: true,
          trackingId: true,
          tracking: { select: { organizationId: true, name: true } },
        },
      });

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      await prisma.$transaction([
        prisma.leadHistory.create({
          data: {
            leadId: input.leadId,
            notes: "Lead arquivado",
            userId,
            action: "DELETED",
          },
        }),

        prisma.lead.update({
          where: { id: input.leadId },
          data: {
            currentAction: "DELETED",
          },
        }),
      ]);

      if (leadExists.tracking) {
        await logActivity({
          organizationId: leadExists.tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          subAppSlug: "tracking-pipeline",
          featureKey: "lead.archived",
          action: "lead.archived",
          actionLabel: `Arquivou o lead "${leadExists.name}"`,
          resource: leadExists.name,
          resourceId: leadExists.id,
          metadata: { trackingName: leadExists.tracking.name },
        });
      }

      return {
        lead: leadExists,
      };
    } catch (error) {
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
