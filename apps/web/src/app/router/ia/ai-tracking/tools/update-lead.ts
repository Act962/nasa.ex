import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const updateLeadTool = (userId: string) =>
  tool({
    description:
      "Atualiza campos de um lead existente: nome, email, telefone, descrição, valor ou temperatura. NÃO use para mover entre colunas — use moveLeadToStatus para isso.",
    inputSchema: z.object({
      leadId: z.string().describe("ID do lead a ser atualizado"),
      name: z.string().optional().describe("Novo nome"),
      email: z.string().optional().describe("Novo e-mail"),
      phone: z
        .string()
        .optional()
        .describe("Não permita atualizar o telefone."),
      description: z.string().optional().describe("Nova descrição do lead"),
      amount: z.number().optional().describe("Novo valor potencial do negócio"),
      temperature: z
        .enum(["COLD", "WARM", "HOT", "VERY_HOT"])
        .optional()
        .describe("Temperatura do lead: COLD, WARM, HOT ou VERY_HOT"),
    }),
    execute: async ({
      leadId,
      name,
      email,
      description,
      amount,
      temperature,
    }) => {
      try {
        const lead = await prisma.lead.update({
          where: { id: leadId },
          data: {
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(description !== undefined && { description }),
            ...(amount !== undefined && { amount: new Decimal(amount) }),
            ...(temperature !== undefined && { temperature }),
          },
          select: {
            id: true,
            name: true,
            statusId: true,
            updatedAt: true,
            description: true,
          },
        });

        console.log(lead);

        return {
          success: true,
          message: `Lead "${lead.name}" atualizado com sucesso.`,
          leadId: lead.id,
          statusId: lead.statusId,
          updatedAt: lead.updatedAt.toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível atualizar o lead.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
