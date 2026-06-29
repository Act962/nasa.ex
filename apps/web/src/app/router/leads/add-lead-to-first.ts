import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";
import { LeadAction } from "@/generated/prisma/enums";
import { recordLeadHistory } from "./utils/history";
/**
 * 🟢 Adicionar Lead como o primeiro da coluna
 */ export const addLeadFirst = base
  .use(requiredAuthMiddleware)
  .route({
    method: "POST",
    summary: "Add a lead as the first in the column (statusId)",
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

      // Se já é o primeiro na mesma coluna, apenas retorna
      if (!isChangingColumn && lead.order === new Decimal(0)) {
        return {
          leadName: lead.name,
          trackingId: lead.trackingId,
        };
      }

      // Abre espaço no topo da coluna destino
      await tx.lead.updateMany({
        where: {
          statusId,
          id: { not: leadId },
        },
        data: { order: { increment: 1 } },
      });

      // Move o lead para o topo
      await tx.lead.update({
        where: { id: leadId },
        data: {
          statusId,
          order: 0,
        },
      });

      await recordLeadHistory({
        leadId,
        userId: context.user.id,
        action: LeadAction.ACTIVE,
        notes: "Lead movido para o topo da coluna",
        tx,
      });

      return {
        leadName: lead.name,
        trackingId: lead.trackingId,
      };
    });
  });
