import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/features/admin/lib/activity-logger";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { trackLeadEvent } from "@/lib/lead-journey/track";

// 🟦 UPDATE
export const updateManyStatusLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update many leads status",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        leadsIds: z.array(z.string()),
        statusId: z.string().optional(),
        trackingId: z.string().optional(),
      })
      .refine(
        (v) =>
          v.statusId !== undefined ||
          v.trackingId !== undefined || {
            message: "No fields to update",
            path: ["id"],
          },
      ),
  )

  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findMany({
        where: { id: { in: input.leadsIds } },
      });

      if (leadExists.length === 0) {
        throw errors.NOT_FOUND;
      }

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.updateMany({
          where: { id: { in: input.leadsIds } },
          data: {
            statusId: input.statusId,
            trackingId: input.trackingId,
            ...(input.statusId ? { lastStatusChangeAt: new Date() } : {}),
          },
        });

        await Promise.all(
          input.leadsIds.map((leadId) =>
            recordLeadHistory({
              leadId,
              userId: context.user.id,
              action: LeadAction.ACTIVE,
              notes: "Status do lead atualizado em lote",
              tx,
            }),
          ),
        );

        return { lead };
      });

      // Log activity
      if (input.statusId && input.trackingId) {
        const fromStatusIds = Array.from(
          new Set(
            leadExists.map((lead) => lead.statusId).filter(Boolean) as string[],
          ),
        );
        const [tracking, newStatus, fromStatuses] = await Promise.all([
          prisma.tracking.findUnique({
            where: { id: input.trackingId },
            select: { organizationId: true, name: true },
          }),
          prisma.status.findUnique({
            where: { id: input.statusId },
            select: { name: true },
          }),
          fromStatusIds.length
            ? prisma.status.findMany({
                where: { id: { in: fromStatusIds } },
                select: { id: true, name: true },
              })
            : Promise.resolve([]),
        ]);
        if (tracking) {
          const fromStatusName = fromStatuses[0]?.name;
          await logActivity({
            organizationId: tracking.organizationId,
            userId: context.user.id,
            userName: context.user.name,
            userEmail: context.user.email,
            userImage: (context.user as any).image,
            appSlug: "tracking",
            action: "lead.moved",
            actionLabel:
              fromStatusName && fromStatuses.length === 1
                ? `Moveu ${input.leadsIds.length} lead(s) de "${fromStatusName}" para "${newStatus?.name ?? input.statusId}"`
                : `Moveu ${input.leadsIds.length} lead(s) para a coluna "${newStatus?.name ?? input.statusId}"`,
            subAppSlug: "tracking-pipeline",
            featureKey: "lead.dragged",
            metadata: {
              count: input.leadsIds.length,
              statusName: newStatus?.name,
              trackingName: tracking.name,
              fromStatusIds,
              fromStatusNames: fromStatuses.map((s) => s.name),
              toStatusId: input.statusId,
            },
          });
        }
      }

      if (input.statusId) {
        const leadStatusBefore = new Map(
          leadExists.map((lead) => [lead.id, lead.statusId]),
        );
        await Promise.all(
          input.leadsIds.map((leadId) =>
            trackLeadEvent({
              leadId,
              kind: "status_changed",
              actorId: context.user.id,
              metadata: {
                from: leadStatusBefore.get(leadId),
                to: input.statusId,
                bulk: true,
              },
            }),
          ),
        );
      }

      return result;
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
