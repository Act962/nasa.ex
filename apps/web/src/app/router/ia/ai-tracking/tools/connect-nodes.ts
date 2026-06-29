import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const connectNodesTool = () =>
  tool({
    description:
      "Conecta dois nós de um workflow, criando a transição de um para o outro. Use após adicionar todos os nós com addNode.",
    inputSchema: z.object({
      workflowId: z.string().describe("ID do workflow"),
      fromNodeId: z.string().describe("ID do nó de origem (que dispara a conexão)"),
      toNodeId: z.string().describe("ID do nó de destino (que recebe a conexão)"),
    }),
    execute: async ({ workflowId, fromNodeId, toNodeId }) => {
      try {
        const [fromNode, toNode] = await Promise.all([
          prisma.node.findFirst({ where: { id: fromNodeId, workflowId }, select: { id: true, name: true } }),
          prisma.node.findFirst({ where: { id: toNodeId, workflowId }, select: { id: true, name: true } }),
        ]);

        if (!fromNode) {
          return { success: false, message: `Nó de origem "${fromNodeId}" não encontrado neste workflow.` };
        }
        if (!toNode) {
          return { success: false, message: `Nó de destino "${toNodeId}" não encontrado neste workflow.` };
        }

        const connection = await prisma.connection.create({
          data: {
            workflowId,
            fromNodeId,
            toNodeId,
            fromOutput: "source-1",
            toInput: "target-1",
          },
          select: { id: true },
        });

        return {
          success: true,
          message: `Conexão criada: "${fromNode.name}" → "${toNode.name}".`,
          connectionId: connection.id,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível criar a conexão.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
