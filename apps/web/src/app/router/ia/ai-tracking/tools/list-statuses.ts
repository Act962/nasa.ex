import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const listStatusesTool = (trackingId: string) =>
  tool({
    description:
      "Lista todas as colunas/status disponíveis no tracking, com seus IDs e nomes. Chame este tool antes de criar um lead ou movê-lo, se ainda não souber o statusId.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const statuses = await prisma.status.findMany({
          where: { trackingId },
          orderBy: { order: "asc" },
          select: { id: true, name: true, color: true, order: true },
        });

        return {
          success: true,
          statuses: statuses.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            order: s.order.toString(),
          })),
          total: statuses.length,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível listar os status.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
