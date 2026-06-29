import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const moveLeadToStatusTool = (userId: string) =>
  tool({
    description:
      "Move um lead para uma coluna/status diferente no funil (Kanban de leads). Use listStatuses para descobrir os IDs das colunas antes de chamar este tool.",
    inputSchema: z.object({
      leadId: z.string().describe("ID do lead a mover"),
      statusId: z.string().describe("ID da coluna/status de destino"),
    }),
    execute: async ({ leadId, statusId }) => {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const lead = await tx.lead.findUnique({
            where: { id: leadId },
            select: {
              id: true,
              name: true,
              statusId: true,
              order: true,
              trackingId: true,
            },
          });

          if (!lead) {
            throw new Error("Lead não encontrado");
          }

          const isChangingColumn = lead.statusId !== statusId;

          if (isChangingColumn) {
            await tx.lead.updateMany({
              where: {
                statusId: lead.statusId,
                trackingId: lead.trackingId,
                order: { gt: lead.order },
              },
              data: { order: { decrement: 1 } },
            });
          }

          await tx.lead.updateMany({
            where: { statusId, trackingId: lead.trackingId, id: { not: leadId } },
            data: { order: { increment: 1 } },
          });

          const updated = await tx.lead.update({
            where: { id: leadId },
            data: { statusId, order: 0 },
            select: {
              id: true,
              name: true,
              statusId: true,
              status: { select: { name: true } },
            },
          });

          return updated;
        });

        return {
          success: true,
          message: `Lead "${result.name}" movido para a coluna "${result.status?.name}".`,
          leadId: result.id,
          newStatusId: result.statusId,
          statusName: result.status?.name ?? null,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível mover o lead.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
