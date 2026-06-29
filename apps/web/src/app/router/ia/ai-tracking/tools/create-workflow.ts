import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const createWorkflowTool = (trackingId: string, userId: string) =>
  tool({
    description:
      "Cria uma nova automação (workflow) no tracking com nome e descrição. Após criar, adicione os nós com addNode e conecte-os com connectNodes.",
    inputSchema: z.object({
      name: z.string().describe("Nome da automação, ex: 'Boas-vindas ao lead'"),
      description: z
        .string()
        .optional()
        .describe("Descrição do objetivo da automação"),
    }),
    execute: async ({ name, description }) => {
      try {
        const workflow = await prisma.workflow.create({
          data: {
            name,
            description: description ?? null,
            trackingId,
            userId,
          },
          select: { id: true, name: true, description: true, createdAt: true },
        });

        return {
          success: true,
          message: `Automação "${name}" criada com sucesso. Agora adicione os nós com addNode.`,
          workflowId: workflow.id,
          name: workflow.name,
          description: workflow.description,
          createdAt: workflow.createdAt.toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível criar a automação.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
