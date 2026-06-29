import prisma from "@/lib/prisma";
import { dispatchManualTrigger } from "@/inngest/utils";
import { tool } from "ai";
import { z } from "zod";

export const executeWorkflowTool = (trackingId: string) =>
  tool({
    description:
      "Dispara a execução de um workflow existente. Use somente em workflows com gatilho do tipo MANUAL_TRIGGER.",
    inputSchema: z.object({
      workflowId: z.string().describe("ID do workflow a ser executado"),
    }),
    execute: async ({ workflowId }) => {
      try {
        const workflow = await prisma.workflow.findFirst({
          where: { id: workflowId, trackingId },
          select: { id: true, name: true, isActive: true },
        });

        if (!workflow) {
          return {
            success: false,
            message: `Workflow "${workflowId}" não encontrado neste tracking.`,
          };
        }

        if (!workflow.isActive) {
          return {
            success: false,
            message: `Automação "${workflow.name}" está desativada.`,
          };
        }

        await dispatchManualTrigger({ workflowId });

        return {
          success: true,
          message: `Automação "${workflow.name}" disparada com sucesso.`,
          workflowId: workflow.id,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível executar a automação.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
