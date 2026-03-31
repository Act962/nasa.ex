import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";

// 🟥 DELETE
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
        // permite deletar por id OU pelo par (phone + trackingId)
        id: z.string().optional(),
        phone: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (data) => data.id || (data.phone && data.trackingId),
        "You must provide either 'id' or both 'phone' and 'trackingId'."
      )
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors, context }) => {
    try {
      let deletedLead;

      if (input.id) {
        deletedLead = await prisma.lead.delete({ where: { id: input.id } });
      } else if (input.phone && input.trackingId) {
        deletedLead = await prisma.lead.delete({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });
      }

      if (deletedLead) {
        const tracking = await prisma.tracking.findUnique({
          where: { id: deletedLead.trackingId },
          select: { organizationId: true },
        });
        if (tracking) {
          await logActivity({
            organizationId: tracking.organizationId,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "tracking",
            action: "lead.deleted",
            actionLabel: `Excluiu o lead "${deletedLead.name}"`,
            resource: deletedLead.name,
            resourceId: deletedLead.id,
          });
        }
      }

      return { success: !!deletedLead };
    } catch (err: any) {
      if (err.code === "P2025") {
        // Prisma error: record not found
        throw errors.NOT_FOUND;
      }

      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
