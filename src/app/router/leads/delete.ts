import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";

export const deleteLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "DELETE",
    summary: "Delete a lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        ids: z.array(z.string()),
      })
      .refine((data) => data.ids.length > 0, "Você deve fornecer 'ids'."),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors, context }) => {
    try {
      const leadsFound = await prisma.lead.findMany({
        where: { id: { in: input.ids } },
        select: {
          id: true,
          name: true,
          trackingId: true,
          tracking: {
            select: {
              organizationId: true,
            },
          },
        },
      });

      if (leadsFound.length === 0) {
        return { success: false };
      }

      const organizationIds = [
        ...new Set(leadsFound.map((l) => l.tracking.organizationId)),
      ];
      const trackingIds = [...new Set(leadsFound.map((l) => l.trackingId))];

      const [members, trackingParticipants] = await Promise.all([
        prisma.member.findMany({
          where: {
            userId: context.user.id,
            organizationId: { in: organizationIds },
          },
          select: { organizationId: true, role: true },
        }),
        prisma.trackingParticipant.findMany({
          where: {
            userId: context.user.id,
            trackingId: { in: trackingIds },
          },
          select: { trackingId: true, role: true },
        }),
      ]);

      const memberMap = new Map(members.map((m) => [m.organizationId, m.role]));
      const trackingParticipantMap = new Map(
        trackingParticipants.map((tp) => [tp.trackingId, tp.role]),
      );

      for (const lead of leadsFound) {
        const orgRole = memberMap.get(lead.tracking.organizationId);
        const trackingRole = trackingParticipantMap.get(lead.trackingId);

        const isAllowedByOrg =
          orgRole && ["owner", "admin", "moderador"].includes(orgRole);
        const isTrackingOwner = trackingRole === "OWNER";

        if (!isAllowedByOrg && !isTrackingOwner) {
          throw errors.FORBIDDEN({
            message: `Você não tem permissão para deletar o lead "${lead.name}".`,
          });
        }
      }

      // 5. Proceed with deletion
      await prisma.lead.deleteMany({
        where: { id: { in: leadsFound.map((lead) => lead.id) } },
      });

      // 6. Log activity for each lead
      for (const lead of leadsFound) {
        const organizationId = lead.tracking.organizationId;

        if (organizationId) {
          await logActivity({
            organizationId,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "tracking",
            subAppSlug: "tracking-pipeline",
            featureKey: "lead.deleted",
            action: "lead.deleted",
            actionLabel: `Excluiu o lead "${lead.name}"`,
            resource: lead.name,
            resourceId: lead.id,
          });
        }
      }

      return { success: true };
    } catch (err: any) {
      // Re-throw if it's already an oRPC error
      if (err.message && (err.type === "FORBIDDEN" || err.status === 403)) {
        throw err;
      }

      if (err.code === "P2025") {
        throw errors.NOT_FOUND;
      }

      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
