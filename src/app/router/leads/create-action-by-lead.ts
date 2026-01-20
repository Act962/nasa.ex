import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { TypeAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

export const createActionByLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Create a new lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
      leadId: z.string(),
      description: z.string().optional(),
      score: z.number().default(0),
      isDone: z.boolean().default(false),
      type: z.enum(TypeAction).default(TypeAction.TASK),
      trackingId: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      responsibles: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const action = await prisma.action.create({
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
            create: input.responsibles.map((id) => ({
              userId: id,
            })),
          },
        },
      });

      return { action };
    } catch (error) {
      console.error(error);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
