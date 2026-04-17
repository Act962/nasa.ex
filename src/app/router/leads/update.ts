import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { logActivity } from "@/lib/activity-logger";
import { z } from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
import { sendWorkflowExecution } from "@/inngest/utils";

// 🟦 UPDATE
export const updateLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update an existing lead",
    tags: ["Leads"],
  })
  .input(
    z
      .object({
        id: z.string(),
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        description: z.string().optional(),
        statusId: z.string().optional(),
        responsibleId: z.string().optional(),
        tagIds: z.array(z.string()).optional(),
        isConversation: z.boolean().optional().default(false),
        active: z.boolean().optional().default(false),
        statusFlow: z.enum(["WAITING", "ACTIVE", "FINISHED"]).optional(),
        amount: z.number().optional(),
        trackingId: z.string().optional(),
        orgProjectId: z.string().nullable().optional(),
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.phone !== undefined ||
          v.email !== undefined ||
          v.description !== undefined ||
          v.statusId !== undefined ||
          v.responsibleId !== undefined ||
          v.trackingId !== undefined ||
          v.tagIds !== undefined ||
          v.active !== undefined ||
          v.statusFlow !== undefined ||
          v.amount !== undefined ||
          v.orgProjectId !== undefined,
        {
          message: "No fields to update",
          path: ["id"],
        },
      ),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const leadExists = await prisma.lead.findUnique({
        where: { id: input.id },
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

      if (!leadExists) {
        throw errors.NOT_FOUND;
      }

      const result = await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.update({
          where: { id: input.id },
          data: {
            name: input.name,
            phone: input.phone,
            email: input.email,
            description: input.description,
            statusId: input.statusId,
            trackingId: input.trackingId,
            orgProjectId: input.orgProjectId,
            responsibleId: input.responsibleId,
            isActive: input.active,
            amount: input.amount,
            ...(input.statusFlow ? { statusFlow: input.statusFlow as any } : {}),
            leadTags: input.tagIds
              ? {
                  deleteMany: {},
                  create: input.tagIds.map((tagId) => ({
                    tagId,
                  })),
                }
              : undefined,
          },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            statusId: true,
            trackingId: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
            responsibleId: true,
          },
        });

        await recordLeadHistory({
          leadId: lead.id,
          userId: context.user.id,
          action: LeadAction.ACTIVE,
          notes: "Lead atualizado",
          tx,
        });

        let workflows: { id: string }[] = [];
        if (input.tagIds) {
          workflows = await tx.workflow.findMany({
            where: {
              trackingId: lead.trackingId,
              nodes: {
                some: {
                  type: "LEAD_TAGGED",
                  data: {
                    path: ["action", "tagIds"],
                    array_contains: input.tagIds,
                  },
                },
              },
            },
            select: {
              id: true,
            },
          });
        }

        if (input.statusId) {
          workflows = await tx.workflow.findMany({
            where: {
              trackingId: lead.trackingId,
              nodes: {
                some: {
                  type: "MOVE_LEAD_STATUS",
                  data: {
                    path: ["action", "statusId"],
                    equals: input.statusId,
                  },
                },
              },
            },
            select: {
              id: true,
            },
          });
        }

        return { lead, workflows };
      });

      if (result.workflows && result.workflows.length > 0) {
        await Promise.all(
          result.workflows.map((workflow) =>
            sendWorkflowExecution({
              workflowId: workflow.id,
              initialData: {
                lead: result.lead,
                previousLead: leadExists,
              },
            }),
          ),
        );
      }

      // Log activity for meaningful changes only
      const tracking = await prisma.tracking.findUnique({
        where: { id: result.lead.trackingId },
        select: { organizationId: true, name: true },
      });
      if (tracking) {
        let actionLabel = "";
        if (input.statusId && input.statusId !== leadExists.statusId) {
          const newStatus = await prisma.status.findUnique({ where: { id: input.statusId }, select: { name: true } });
          actionLabel = `Moveu o lead "${result.lead.name}" para a coluna "${newStatus?.name ?? input.statusId}"`;
        } else if (input.name && input.name !== leadExists.name) {
          actionLabel = `Renomeou o lead de "${leadExists.name}" para "${input.name}"`;
        } else if (input.active !== undefined && input.active !== leadExists.isActive) {
          actionLabel = input.active ? `Ativou o lead "${result.lead.name}"` : `Arquivou o lead "${result.lead.name}"`;
        } else if (input.amount !== undefined) {
          actionLabel = `Atualizou o valor do lead "${result.lead.name}"`;
        } else {
          actionLabel = `Atualizou o lead "${result.lead.name}"`;
        }
        await logActivity({
          organizationId: tracking.organizationId,
          userId: context.user.id,
          userName: context.user.name,
          userEmail: context.user.email,
          userImage: (context.user as any).image,
          appSlug: "tracking",
          action: input.statusId && input.statusId !== leadExists.statusId ? "lead.moved" : "lead.updated",
          actionLabel,
          resource: result.lead.name,
          resourceId: result.lead.id,
          metadata: { trackingName: tracking.name },
        });
      }

      return result;
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
