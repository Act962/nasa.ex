import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../auth";
import prisma from "@/lib/prisma";
import { z } from "zod";

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

          // Busca o maior order da nova coluna
          const lastLead = await tx.lead.findFirst({
            where: { statusId },
            orderBy: { order: "desc" },
            select: { order: true },
          });

          const newOrder = lastLead !== null ? lastLead.order + 1 : 0;

          await tx.lead.update({
            where: { id: leadId },
            data: { statusId, order: newOrder },
          });
        } else {
          // Se está na mesma coluna, move para o final
          const lastLead = await tx.lead.findFirst({
            where: { statusId, id: { not: leadId } },
            orderBy: { order: "desc" },
            select: { order: true },
          });

          const newOrder = lastLead !== null ? lastLead.order + 1 : 0;

          // Se já é o último, não faz nada
          if (lead.order === newOrder) {
            return { leadName: lead.name };
          }

          await tx.lead.update({
            where: { id: leadId },
            data: { order: newOrder },
          });
        }

        return { leadName: lead.name };
      });
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
