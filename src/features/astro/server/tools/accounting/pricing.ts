import "server-only";
import { tool } from "ai";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AgentContext } from "@/features/astro/server/agents/types";
import { assertAccountingReadAccess, ACCOUNTING_TAB_URL } from "./access";

const MAX_ROWS = 20;
const OPEN_PROPOSAL_STATUSES = ["RASCUNHO", "ENVIADA", "VISUALIZADA"] as const;

export function buildAccountingPricingTools(ctx: AgentContext) {
  return {
    diagnose_pricing: tool({
      description:
        "DIAGNÓSTICO DE PREÇO E IMPOSTO no Forge: lista produtos/serviços SEM CLASSIFICAÇÃO TRIBUTÁRIA (NCM/NBS, item da LC 116, cClassTrib — obrigatória nas notas a partir da Reforma) e propostas em aberto SEM O IMPOSTO CALCULADO (preço que pode estar deixando o imposto sair da margem). Só leitura. Use para 'meus preços cobrem o imposto?', 'o que falta classificar', 'estou precificando certo?', 'cClassTrib'. Para calcular o preço certo de um item, depois use run_calculator com markup ou margem_real.",
      inputSchema: z.object({}),
      execute: async () => {
        const access = await assertAccountingReadAccess(ctx);
        if (!access.ok) return { error: access.error };

        const proposalWithoutTaxWhere: Prisma.ForgeProposalWhereInput = {
          organizationId: ctx.organizationId,
          status: { in: [...OPEN_PROPOSAL_STATUSES] },
          taxBreakdown: { equals: Prisma.AnyNull },
        };
        const [
          totalProducts,
          unclassifiedCount,
          unclassifiedProducts,
          openProposalsWithoutTax,
          openProposalsWithoutTaxCount,
          openProposalsCount,
        ] =
          await Promise.all([
            prisma.forgeProduct.count({ where: { organizationId: ctx.organizationId } }),
            prisma.forgeProduct.count({ where: { organizationId: ctx.organizationId, taxClassificationId: null } }),
            prisma.forgeProduct.findMany({
              where: { organizationId: ctx.organizationId, taxClassificationId: null },
              select: { id: true, name: true, sku: true, value: true },
              orderBy: { updatedAt: "desc" },
              take: MAX_ROWS,
            }),
            prisma.forgeProposal.findMany({
              where: proposalWithoutTaxWhere,
              select: { id: true, number: true, title: true, status: true, createdAt: true },
              orderBy: { createdAt: "desc" },
              take: MAX_ROWS,
            }),
            prisma.forgeProposal.count({ where: proposalWithoutTaxWhere }),
            prisma.forgeProposal.count({
              where: { organizationId: ctx.organizationId, status: { in: [...OPEN_PROPOSAL_STATUSES] } },
            }),
          ]);

        return {
          products: {
            total: totalProducts,
            withoutTaxClassification: unclassifiedCount,
            examples: unclassifiedProducts.map((product) => ({
              id: product.id,
              name: product.name,
              sku: product.sku,
              price: Number(product.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
            })),
          },
          proposals: {
            openTotal: openProposalsCount,
            withoutTaxCalculated: openProposalsWithoutTaxCount,
            examples: openProposalsWithoutTax.map((proposal) => ({
              id: proposal.id,
              number: proposal.number,
              title: proposal.title,
              status: proposal.status,
              createdAt: proposal.createdAt.toISOString().slice(0, 10),
            })),
          },
          glossaryTermIds: ["cclasstrib", "ncm", "nbs", "lc116-item", "markup-divisor", "aliquota-efetiva"],
          url: `${ACCOUNTING_TAB_URL}&sub=pricing`,
        };
      },
    }),
  };
}
