import prisma from "@/lib/prisma";
import { tool } from "ai";
import { z } from "zod";

export const findLeadsTool = (trackingId: string) =>
  tool({
    description: [
      "Busca leads no tracking por nome, email ou telefone.",
      "REGRA CRÍTICA: NÃO preencha nenhum campo opcional por dedução ou padrão.",
      "Só filtre pelo que o usuário mencionar explicitamente.",
    ].join(" "),
    inputSchema: z.object({
      search: z
        .string()
        .optional()
        .describe(
          "Texto para busca por nome, email ou telefone. Só preencha se o usuário mencionar um critério explícito.",
        ),
      statusId: z
        .string()
        .optional()
        .describe("Filtrar por coluna/status específica (opcional)."),
      limit: z
        .number()
        .min(1)
        .max(30)
        .default(10)
        .describe("Máximo de resultados. Padrão 10."),
    }),
    execute: async ({ search, statusId, limit }) => {
      try {
        const leads = await prisma.lead.findMany({
          where: {
            trackingId,
            ...(statusId && { statusId }),
            ...(search && {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            description: true,
            amount: true,
            temperature: true,
            statusId: true,
            createdAt: true,
            status: { select: { id: true, name: true } },
          },
        });

        if (leads.length === 0) {
          return {
            success: true,
            message: "Nenhum lead encontrado com esses critérios.",
            leads: [],
            total: 0,
          };
        }

        return {
          success: true,
          message: `${leads.length} lead(s) encontrado(s).`,
          leads: leads.map((l) => ({
            id: l.id,
            name: l.name,
            phone: l.phone,
            email: l.email,
            description: l.description,
            amount: l.amount?.toString() ?? null,
            temperature: l.temperature,
            statusId: l.statusId,
            statusName: l.status?.name ?? null,
            createdAt: l.createdAt.toISOString(),
          })),
          total: leads.length,
        };
      } catch (error) {
        return {
          success: false,
          message: "Não foi possível buscar os leads.",
          error: error instanceof Error ? error.message : "Erro desconhecido",
        };
      }
    },
  });
