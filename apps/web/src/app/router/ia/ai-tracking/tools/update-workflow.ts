import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const updateWorkflowTool = () =>
  tool({
    description:
      "Atualiza o nome e/ou a descrição de uma automação existente. Use quando o usuário quiser renomear ou editar a descrição de um workflow. Se o workflow não for encontrado, chame listWorkflows e peça ao usuário que especifique qual deseja editar.",
    inputSchema: z.object({
      workflowId: z.string().describe("ID do workflow a ser atualizado"),
      name: z
        .string()
        .optional()
        .describe("Novo nome da automação (omita para não alterar)"),
      description: z
        .string()
        .optional()
        .describe("Nova descrição da automação (omita para não alterar)"),
    }),
    execute: async ({ workflowId, name, description }) => {
      try {
        const workflow = await prisma.workflow.findUnique({
          where: { id: workflowId },
          select: { id: true, trackingId: true, name: true, description: true },
        });

        if (!workflow) {
          return {
            success: false,
            message: `Automação "${workflowId}" não encontrada.`,
          };
        }

        const updated = await prisma.workflow.update({
          where: { id: workflowId },
          data: {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
          },
          select: { id: true, name: true, description: true, trackingId: true },
        });

        return {
          success: true,
          message: `Automação "${updated.name}" atualizada com sucesso.`,
          workflowId: updated.id,
          name: updated.name,
          description: updated.description,
          trackingId: updated.trackingId,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível atualizar a automação.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
