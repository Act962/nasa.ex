import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const getWorkflowTool = () =>
  tool({
    description:
      "Retorna os detalhes completos de um workflow, incluindo seus nós e conexões. Use para verificar o que foi criado antes de executar. Se o workflow não for encontrado, chame listWorkflows para listar as automações disponíveis e peça ao usuário que especifique qual deseja visualizar ou modificar.",
    inputSchema: z.object({
      workflowId: z.string().describe("ID do workflow"),
    }),
    execute: async ({ workflowId }) => {
      try {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            nodes: {
              select: {
                id: true,
                type: true,
                name: true,
                data: true,
                position: true,
              },
            },
            connections: {
              select: {
                id: true,
                fromNodeId: true,
                toNodeId: true,
              },
            },
          },
        });

        if (!workflow) {
          return {
            success: false,
            message: `Workflow "${workflowId}" não encontrado.`,
          };
        }

        return {
          success: true,
          workflow: {
            id: workflow.id,
            name: workflow.name,
            description: workflow.description,
            createdAt: workflow.createdAt.toISOString(),
            nodes: workflow.nodes.map((n) => ({
              id: n.id,
              type: n.type,
              name: n.name,
              data: n.data,
            })),
            connections: workflow.connections.map((c) => ({
              id: c.id,
              from: c.fromNodeId,
              to: c.toNodeId,
            })),
          },
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível obter o workflow.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
