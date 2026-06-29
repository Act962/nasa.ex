import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";

export const addLeadLast = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Add a lead as the last in the column (statusId)",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
    }),
  )
  .output(
    z.object({
      leadName: z.string(),
      trackingId: z.string(),
    }),
  )
  .handler(async ({ input, errors, context }) => {
    const { leadId, statusId } = input;

    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: leadId },
        select: {
          id: true,
          statusId: true,
          order: true,
          name: true,
          trackingId: true,
        },
      });

      if (!lead) throw errors.NOT_FOUND;

      const isChangingColumn = lead.statusId !== statusId;

      // Fecha o espaço na coluna antiga
      if (isChangingColumn) {
        await tx.lead.updateMany({
          where: {
            statusId: lead.statusId,
            order: { gt: lead.order },
          },
          data: { order: { decrement: 1 } },
        });
      }

      // Busca o último order da coluna destino
      const lastLead = await tx.lead.findFirst({
        where: {
          statusId,
          id: { not: leadId },
        },
        orderBy: { order: "desc" },
        select: { order: true },
      });

      let newOrder: Decimal;

      newOrder = lastLead
        ? new Decimal(lastLead.order).plus(1)
        : new Decimal(0);

      // const newOrder = lastLead ? lastLead.order + 1 : 0;

      // Se já está no final da mesma coluna, apenas retorna
      if (!isChangingColumn && lead.order === newOrder) {
        return {
          leadName: lead.name,
          trackingId: lead.trackingId,
        };
      }

      // Move o lead para o final
      await tx.lead.update({
        where: { id: leadId },
        data: {
          statusId,
          order: newOrder,
        },
      });

      await recordLeadHistory({
        leadId,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: "Lead movido para o final da coluna",
        tx,
      });

      return {
        leadName: lead.name,
        trackingId: lead.trackingId,
      };
    });
  });
