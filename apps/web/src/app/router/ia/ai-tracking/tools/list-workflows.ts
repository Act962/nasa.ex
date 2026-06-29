import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const listWorkflowsTool = (trackingId: string) =>
  tool({
    description:
      "Lista todas as automações (workflows) existentes no tracking, com seus IDs, nomes, descrições e quantidade de nós.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const workflows = await prisma.workflow.findMany({
          where: { trackingId },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            _count: { select: { nodes: true } },
          },
        });

        return {
          success: true,
          workflows: workflows.map((w) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            nodeCount: w._count.nodes,
            createdAt: w.createdAt.toISOString(),
          })),
          total: workflows.length,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível listar as automações.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
