import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { TypeAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

export const updateActionByLead = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
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
      startDate: z.date().optional(),
      endDate: z.date().optional(),
      responsibles: z.array(z.string()).default([]),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const existingAction = await prisma.action.findFirst({
      where: {
        id: input.actionId,
        workspace: { organizationId: context.org.id },
      },
      select: { id: true, leadId: true, trackingId: true },
    });

    if (!existingAction) {
      throw errors.NOT_FOUND({
        message: "Ação não encontrada ou sem acesso",
      });
    }

    // Repontar pra outro lead só é permitido dentro do mesmo tracking da
    // action — caso contrário o vínculo lead↔tracking ficaria incoerente.
    if (input.leadId && input.leadId !== existingAction.leadId) {
      const lead = await prisma.lead.findFirst({
        where: {
          id: input.leadId,
          trackingId: existingAction.trackingId ?? undefined,
          tracking: {
            organizationId: context.org.id,
            participants: { some: { userId: context.user.id } },
          },
        },
        select: { id: true },
      });

      if (!lead) {
        throw errors.FORBIDDEN({
          message: "Lead não encontrado, sem acesso ou de outro tracking",
        });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const action = await tx.action.update({
        where: { id: input.actionId },
        data: {
          title: input.title,
          leadId: input.leadId,
          description: input.description,
          score: input.score,
          isDone: input.isDone,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate,
          responsibles: {
            deleteMany: {},
            create: input.responsibles.map((userId) => ({ userId })),
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
  });
