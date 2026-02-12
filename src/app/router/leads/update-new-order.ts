import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "../../middlewares/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export const updateNewOrder = base
  .use(requiredAuthMiddleware)
  .route({
    method: "PUT",
    summary: "Update lead order using floating order strategy",
    tags: ["Kanban", "Leads"],
  })
  .input(
    z.object({
      leadId: z.string(),
      statusId: z.string(),
      beforeId: z.string().optional(), // lead acima
      afterId: z.string().optional(), // lead abaixo
    }),
  )
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, errors }) => {
    const { leadId, statusId, beforeId, afterId } = input;

    try {
      await prisma.$transaction(async (tx) => {
        const lead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { id: true },
        });

        if (!lead) throw errors.NOT_FOUND;

        let newOrder: Prisma.Decimal;

        const before = beforeId
          ? await tx.lead.findUnique({
              where: { id: beforeId },
              select: { order: true },
            })
          : null;

        const after = afterId
          ? await tx.lead.findUnique({
              where: { id: afterId },
              select: { order: true },
            })
          : null;

        // 🔹 Caso 1: Entre dois leads
        if (before && after) {
          newOrder = new Prisma.Decimal(before.order)
            .plus(after.order)
            .dividedBy(2);
        }
        // 🔹 Caso 2: Indo para o topo
        else if (!before && after) {
          newOrder = new Prisma.Decimal(after.order).minus(1000);
        }
        // 🔹 Caso 3: Indo para o final
        else if (before && !after) {
          newOrder = new Prisma.Decimal(before.order).plus(1000);
        }
        // 🔹 Caso 4: Primeira posição da coluna vazia
        else {
          newOrder = new Prisma.Decimal(1000);
        }

        await tx.lead.update({
          where: { id: leadId },
          data: {
            statusId,
            order: newOrder,
          },
        });
      });

      return { success: true };
    } catch (err) {
      console.error(err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
