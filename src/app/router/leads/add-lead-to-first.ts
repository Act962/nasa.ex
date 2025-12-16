import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
/**
 * 🟢 Adicionar Lead como o primeiro da coluna
 */
export const addLeadFirst = base
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
    })
  )
  .output(z.object({ leadName: z.string() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId } = input;

    try {
      return await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { id: true, statusId: true, order: true, name: true },
        });

        if (!lead) throw errors.NOT_FOUND;

        const oldStatusId = lead.statusId;
        const isChangingColumn = oldStatusId !== statusId;

        // Se está mudando de coluna, fecha o espaço na coluna antiga
        if (isChangingColumn) {
          await tx.lead.updateMany({
            where: {
              statusId: oldStatusId,
              order: { gt: lead.order },
            },
            data: { order: { decrement: 1 } },
          });
        } else {
          // Se está na mesma coluna e já é o primeiro, não faz nada
          if (lead.order === 0) {
            return { leadName: lead.name };
          }
        }

        // Abre espaço na nova coluna (ou atual) para inserir no topo
        await tx.lead.updateMany({
          where: {
            statusId,
            id: { not: leadId },
          },
          data: { order: { increment: 1 } },
        });

        // Coloca o lead como o primeiro
        await tx.lead.update({
          where: { id: leadId },
          data: { statusId, order: 0 },
        });

        return { leadName: lead.name };
      });
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
