import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/client";

export const createLeadTool = (userId: string, trackingId: string) =>
  tool({
    description:
      "Cria um novo lead no tracking. Chame listStatuses primeiro se não souber o statusId. Requer nome, telefone e statusId.",
    inputSchema: z.object({
      name: z.string().describe("Nome completo do lead"),
      phone: z
        .string()
        .describe("Telefone no formato internacional, ex: 5511999999999"),
      email: z.string().optional().describe("E-mail do lead (opcional)"),
      description: z
        .string()
        .optional()
        .describe("Descrição ou observação sobre o lead"),
      statusId: z
        .string()
        .describe("ID da coluna/status onde o lead será criado"),
      amount: z.number().optional().describe("Valor potencial do negócio"),
    }),
    execute: async ({ name, phone, email, description, statusId, amount }) => {
      try {
        const existing = await prisma.lead.findUnique({
          where: { phone_trackingId: { phone, trackingId } },
          select: { id: true, name: true },
        });

        if (existing) {
          return {
            success: false,
            message: `Já existe um lead com o telefone ${phone} neste tracking: "${existing.name}".`,
            leadId: existing.id,
            leadName: existing.name,
          };
        }

        await prisma.lead.updateMany({
          where: { statusId, trackingId },
          data: { order: { increment: 1 } },
        });

        const lead = await prisma.lead.create({
          data: {
            name,
            phone,
            email: email || null,
            description: description || null,
            statusId,
            trackingId,
            order: new Decimal(0),
            responsibleId: userId,
            amount: amount !== undefined ? new Decimal(amount) : new Decimal(0),
          },
          select: {
            id: true,
            name: true,
            statusId: true,
            createdAt: true,
          },
        });

        return {
          success: true,
          message: `Lead "${name}" criado com sucesso.`,
          leadId: lead.id,
          leadName: lead.name,
          statusId: lead.statusId,
          createdAt: lead.createdAt.toISOString(),
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível criar o lead.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
