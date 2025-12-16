import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

export const updateLeadOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update lead order and column position in the Kanban",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
      newOrder: z.number().int().min(0),
    })
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId, newOrder } = input;

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { id: true, statusId: true, order: true },
        });

        if (!lead) throw errors.NOT_FOUND;

        const oldStatusId = lead.statusId;
        const oldOrder = lead.order;
        const isChangingColumn = oldStatusId !== statusId;

        // CASO 1: Mudando de coluna
        if (isChangingColumn) {
          // 1.1: Fecha o espaço na coluna antiga
          await tx.lead.updateMany({
            where: {
              statusId: oldStatusId,
              order: { gt: oldOrder },
            },
            data: { order: { decrement: 1 } },
          });

          // 1.2: Abre espaço na nova coluna
          await tx.lead.updateMany({
            where: {
              statusId,
              order: { gte: newOrder },
            },
            data: { order: { increment: 1 } },
          });

          // 1.3: Move o lead
          await tx.lead.update({
            where: { id: leadId },
            data: { statusId, order: newOrder },
          });
        }
        // CASO 2: Mesma coluna
        else {
          // 2.1: Se não mudou de posição, não faz nada
          if (newOrder === oldOrder) {
            return;
          }

          // 2.2: Movendo para baixo (aumentando order)
          if (newOrder > oldOrder) {
            // Decrementa os leads entre a posição antiga e nova
            await tx.lead.updateMany({
              where: {
                statusId,
                order: { gt: oldOrder, lte: newOrder },
              },
              data: { order: { decrement: 1 } },
            });
          }
          // 2.3: Movendo para cima (diminuindo order)
          else {
            // Incrementa os leads entre a posição nova e antiga
            await tx.lead.updateMany({
              where: {
                statusId,
                order: { gte: newOrder, lt: oldOrder },
              },
              data: { order: { increment: 1 } },
            });
          }

          // 2.4: Move o lead
          await tx.lead.update({
            where: { id: leadId },
            data: { order: newOrder },
          });
        }
      });

      return { success: true };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
