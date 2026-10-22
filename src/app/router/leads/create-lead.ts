import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { trackLeadEvent } from "@/lib/lead-journey/track";
import {
  trackingParamsSchema,
  trackingToLeadData,
} from "@/lib/tracking/tracking-params";

// 🟧 LIST ALL
export const createLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      name: z.string(),
      phone: z.string(),
      email: z.string().optional(),
      description: z.string().optional(),
      statusId: z.string(),
      trackingId: z.string(),
      tracking: trackingParamsSchema.optional(),
    }),
  )
  .output(
    z.object({
      lead: z.object({
        id: z.string(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        description: z.string().nullable(),
        statusId: z.string(),
        trackingId: z.string(),
        // order: z.string(),
        createdAt: z.date(),
      }),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const lead = await prisma.$transaction(async (tx) => {
        const existingLead = await tx.lead.findUnique({
          where: {
            phone_trackingId: {
              phone: input.phone,
              trackingId: input.trackingId,
            },
          },
        });

        if (existingLead) {
          return existingLead;
        }

        const lastLead = await tx.lead.findFirst({
          where: {
            statusId: input.statusId,
            trackingId: input.trackingId,
          },
          orderBy: { order: "desc" },
          select: { order: true },
        });

        let newOrder: Decimal;

        newOrder = lastLead
          ? new Decimal(lastLead.order).plus(1)
          : new Decimal(0);

        // const newOrder = lastLead !== null ? lastLead.order + 1 : 0;

        const newLead = await tx.lead.create({
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            order: newOrder,
            responsibleId: context.user.id,
            assignedAt: new Date(),
            ...trackingToLeadData(input.tracking),
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            // order: true,
            createdAt: true,
          },
        });

        await recordLeadHistory({
          leadId: newLead.id,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: "Lead criado",
          tx,
        });

        return newLead;
      });

      await trackLeadEvent({
        leadId: lead.id,
        kind: "lead_assigned",
        actorId: context.user.id,
        metadata: { responsibleId: context.user.id, source: "manual" },
      });

      // Log activity (non-blocking)
      const tracking = await prisma.tracking.findUnique({
        where: { id: input.trackingId },
        select: { organizationId: true, name: true },
      });
      if (tracking) {
        await logActivity({
          organizationId: tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          subAppSlug: "tracking-pipeline",
          featureKey: "lead.created",
          action: "lead_create",
          actionLabel: `Criou o lead "${input.name}"`,
          resource: input.name,
          resourceId: lead.id,
          metadata: { phone: input.phone, trackingName: tracking.name },
        });

        await chargeStarsByAction(tracking.organizationId, "lead_create", {
          userId: context.user.id,
          description: `Criou lead "${input.name}"`,
          appSlug: "tracking",
        });
      }

      return { lead };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
