import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma, Workflow } from "@/generated/prisma/client";
import { sendWorkflowExecution } from "@/inngest/utils";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { logActivity } from "@/lib/activity-logger";

export const updateNewOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PATCH",
    path: "/update-position",
  })
  .input(
    z.object({
      leadId: z.string(),
      targetStatusId: z.string(),
      beforeId: z.string().optional().nullable(), // ID do lead que ficará ACIMA
      afterId: z.string().optional().nullable(), // ID do lead que ficará ABAIXO
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const { leadId, targetStatusId, beforeId, afterId, trackingId } = input;

    const result = await prisma.$transaction(async (tx) => {
      const currentLead = await tx.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          statusId: true,
          trackingId: true,
          responsibleId: true,
          isActive: true,
        },
      });

      if (!currentLead) throw errors.NOT_FOUND;

      const statusChanged = currentLead.statusId !== targetStatusId;

      let newOrder: Prisma.Decimal;

      const [before, after] = await Promise.all([
        beforeId
          ? tx.lead.findUnique({
              where: { id: beforeId },
              select: { order: true },
            })
          : null,
        afterId
          ? tx.lead.findUnique({
              where: { id: afterId },
              select: { order: true },
            })
          : null,
      ]);

      if (before && after) {
        newOrder = Prisma.Decimal.add(before.order, after.order).div(2);
      } else if (before) {
        newOrder = Prisma.Decimal.add(before.order, 1000);
      } else if (after) {
        newOrder = Prisma.Decimal.sub(after.order, 1000);
      } else {
        // Coluna vazia
        newOrder = new Prisma.Decimal(1000);
      }

      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          order: newOrder,
          statusId: targetStatusId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          statusId: true,
          trackingId: true,
          responsibleId: true,
          isActive: true,
        },
      });

      await recordLeadHistory({
        leadId,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: statusChanged
          ? "Status do lead alterado via Kanban"
          : "Posição do lead alterada na coluna",
        tx,
      });

      let workflows: { id: string }[] = [];

      if (statusChanged) {
        workflows = await tx.workflow.findMany({
          where: {
            trackingId,
            nodes: {
              some: {
                type: "MOVE_LEAD_STATUS",
                data: {
                  path: ["action", "statusId"],
                  equals: targetStatusId,
                },
              },
            },
          },
          select: {
            id: true,
          },
        });
      }

      return {
        updatedLead,
        previousLead: currentLead,
        workflows,
        statusChanged,
      };
    });

    if (result.statusChanged && result.workflows.length > 0) {
      await Promise.all(
        result.workflows.map((workflow) =>
          sendWorkflowExecution({
            workflowId: workflow.id,
            initialData: {
              lead: result.updatedLead,
              previousLead: result.previousLead,
            },
          }),
        ),
      );
    }

    const tracking = await prisma.tracking.findUnique({
      where: { id: trackingId },
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
        featureKey: result.statusChanged ? "lead.dragged" : "lead.reordered",
        action: result.statusChanged ? "lead.dragged" : "lead.reordered",
        actionLabel: result.statusChanged
          ? `Moveu o lead "${result.updatedLead.name}" entre colunas`
          : `Reordenou o lead "${result.updatedLead.name}" na coluna`,
        resource: result.updatedLead.name,
        resourceId: result.updatedLead.id,
        metadata: {
          trackingName: tracking.name,
          fromStatusId: result.previousLead.statusId,
          toStatusId: result.updatedLead.statusId,
          dragSource: "kanban",
        },
      });
    }

    return result.updatedLead;
  });
