import z from "zod";
import prisma from "@/lib/prisma";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { LeadAction } from "@/generated/prisma/enums";

export const addHistoricLead = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Add a movement/history entry to a lead",
    path: "/add-historic-lead",
    tags: ["Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      notes: z.string(),
      author: z.string().optional(),
      actionLead: z.enum(LeadAction),
      reasonId: z.string().optional(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    try {
      const { leadId, notes, author, actionLead, reasonId } = input;
      const userId = author || context.user.id;

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          statusId: true,
          trackingId: true,
        },
      });

      if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

      await prisma.$transaction(async (tx) => {
        await tx.leadHistory.create({
          data: {
            notes,
            action: actionLead,
            lead: { connect: { id: leadId } },
            user: { connect: { id: userId } },
            ...(reasonId && { reason: { connect: { id: reasonId } } }),
          },
        });

        await tx.lead.update({
          where: { id: leadId },
          data: {
            currentAction: actionLead,
            isActive: actionLead === LeadAction.ACTIVE,
          },
        });
      });
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Erro ao adicionar histórico ao lead",
        cause: "INTERNAL_SERVER_ERROR",
      });
    }
  });
