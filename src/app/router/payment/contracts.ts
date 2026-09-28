import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requirePaymentAccess } from "@/app/middlewares/payment-access";
import prisma from "@/lib/prisma";
import { z } from "zod";

/**
 * Lista ForgeContract ATIVOs da org, com filtros opcionais.
 *   - `leadId`: contratos onde ForgeProposal.clientId = leadId
 *   - `search`: filtro por número/título da proposta
 *
 * Reusa a permissão de `contacts.view` — quem vê contatos vê contratos.
 * Retorna dados enxutos pra listagem (número, cliente, valor, período, status).
 */
export const listActiveContracts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requirePaymentAccess("contacts", "view"))
  .route({
    method: "GET",
    summary: "List active Forge contracts (optionally filtered by lead)",
    tags: ["Payment"],
  })
  .input(
    z.object({
      leadId: z.string().optional(),
      search: z.string().optional(),
      includeAllStatuses: z.boolean().default(false),
      page: z.number().default(1),
      perPage: z.number().default(50),
    }),
  )
  .output(
    z.object({
      contracts: z.array(
        z.object({
          id: z.string(),
          number: z.number(),
          status: z.enum(["ATIVO", "ENCERRADO", "CANCELADO", "PENDENTE_ASSINATURA"]),
          startDate: z.date(),
          endDate: z.date(),
          value: z.string(),
          proposalTitle: z.string().nullable(),
          proposalNumber: z.number().nullable(),
          clientLeadId: z.string().nullable(),
          clientName: z.string().nullable(),
          templateName: z.string().nullable(),
          createdAt: z.date(),
        }),
      ),
      total: z.number(),
      // Soma de todo o filtro, não só da página — o cabeçalho da aba mostra o
      // valor total dos contratos e ele não pode mudar ao virar de página.
      totalValue: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    try {
      const where = {
        organizationId: context.org.id,
        isTemplate: false,
        ...(input.includeAllStatuses ? {} : { status: "ATIVO" as const }),
        ...(input.leadId
          ? { proposal: { clientId: input.leadId } }
          : {}),
        ...(input.search
          ? {
              OR: [
                {
                  proposal: {
                    title: {
                      contains: input.search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              ],
            }
          : {}),
      };

      const [rows, total, valueAggregate] = await Promise.all([
        prisma.forgeContract.findMany({
          where,
          include: {
            proposal: {
              select: {
                id: true,
                title: true,
                number: true,
                clientId: true,
                client: { select: { id: true, name: true } },
              },
            },
            template: { select: { id: true, name: true } },
          },
          orderBy: { startDate: "desc" },
          skip: (input.page - 1) * input.perPage,
          take: input.perPage,
        }),
        prisma.forgeContract.count({ where }),
        prisma.forgeContract.aggregate({ where, _sum: { value: true } }),
      ]);

      return {
        contracts: rows.map((row) => ({
          id: row.id,
          number: row.number,
          status: row.status,
          startDate: row.startDate,
          endDate: row.endDate,
          value: row.value.toString(),
          proposalTitle: row.proposal?.title ?? null,
          proposalNumber: row.proposal?.number ?? null,
          clientLeadId: row.proposal?.clientId ?? null,
          clientName: row.proposal?.client?.name ?? null,
          templateName: row.template?.name ?? null,
          createdAt: row.createdAt,
        })),
        total,
        totalValue: (valueAggregate._sum.value ?? 0).toString(),
      };
    } catch (err) {
      console.error("[payment/contracts/listActive]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
