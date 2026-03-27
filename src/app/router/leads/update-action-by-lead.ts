import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { TypeAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

export const updateActionByLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Update a action by lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      actionId: z.string(),
      title: z
        .string()
        .min(3, "Título deve ter pelo menos 3 caracteres")
        .optional(),
      leadId: z.string().optional(),
      description: z.string().optional(),
      score: z.number().default(0).optional(),
      isDone: z.boolean().default(false).optional(),
      type: z.enum(TypeAction).default(TypeAction.TASK).optional(),
      trackingId: z.string().optional(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      responsibles: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const action = await tx.action.update({
          where: {
            id: input.actionId,
          },
          data: {
            title: input.title,
            leadId: input.leadId,
            description: input.description,
            score: input.score,
            isDone: input.isDone,
            type: input.type,
            trackingId: input.trackingId,
            organizationId: context.session.activeOrganizationId,
            createdBy: context.user.id,
            startDate: input.startDate,
            endDate: input.endDate,
            responsibles: {
              deleteMany: {},
              create: input.responsibles.map((id) => ({
                userId: id,
              })),
            },
          },
        });

        if (action.leadId) {
          await recordLeadHistory({
            leadId: action.leadId,
            userId: context.user.id,
            action: LeadAction.ACTIVE,
            notes: `Ação atualizada: ${action.title}`,
            tx,
          });
        }

        return { action };
      });

      return result;
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
