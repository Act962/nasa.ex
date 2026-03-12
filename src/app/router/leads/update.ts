import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
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
        amount: z.number().optional(),
      })
      .refine(
        (v) =>
          v.name !== undefined ||
          v.phone !== undefined ||
          v.email !== undefined ||
          v.description !== undefined ||
          v.statusId !== undefined ||
          v.responsibleId !== undefined ||
          v.tagIds !== undefined ||
          v.active !== undefined ||
          v.amount !== undefined,
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
            responsibleId: input.responsibleId,
            isActive: input.active,
            amount: input.amount,
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

      return result;
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
