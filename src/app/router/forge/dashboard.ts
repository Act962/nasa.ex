import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { ForgeProposalStatus, ForgeContractStatus } from "@/generated/prisma/enums";

function calcProposalTotal(
  products: { quantity: string | { toString(): string }; unitValue: string | { toString(): string }; discount: string | { toString(): string } | null }[],
  proposalDiscount: string | { toString(): string } | null,
  discountType: string | null,
): number {
  let subtotal = 0;
  for (const pp of products) {
    const qty = Number(pp.quantity.toString());
    const unit = Number(pp.unitValue.toString());
    const disc = Number(pp.discount?.toString() ?? "0");
    subtotal += qty * unit - disc;
  }
  if (proposalDiscount && Number(proposalDiscount.toString()) > 0) {
    const d = Number(proposalDiscount.toString());
    subtotal = discountType === "PERCENTUAL" ? subtotal * (1 - d / 100) : subtotal - d;
  }
  return Math.max(0, subtotal);
}

export const getForgeDashboard = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Get forge dashboard stats", tags: ["Forge"] })
  .input(z.object({}))
  .output(
    z.object({
      proposalsSent: z.number(),
      activeContracts: z.number(),
      totalProposalValue: z.string(),
      proposalsPaid: z.number(),
      commissionsGenerated: z.string(),
      recentProposals: z.array(z.any()),
    }),
  )
  .handler(async ({ context, errors }) => {
    try {
      const orgId = context.org.id;

      const [proposalsSent, activeContracts, proposalsPaid, recentProposals, settings] =
        await Promise.all([
          // Propostas enviadas = qualquer status diferente de rascunho
          prisma.forgeProposal.count({
            where: {
              organizationId: orgId,
              status: { not: ForgeProposalStatus.RASCUNHO },
            },
          }),
          // Contratos ativos
          prisma.forgeContract.count({
            where: { organizationId: orgId, status: ForgeContractStatus.ATIVO },
          }),
          // Propostas pagas
          prisma.forgeProposal.count({
            where: { organizationId: orgId, status: ForgeProposalStatus.PAGA },
          }),
          // Propostas recentes (todas)
          prisma.forgeProposal.findMany({
            where: { organizationId: orgId },
            include: {
              client: { select: { id: true, name: true } },
              responsible: { select: { id: true, name: true } },
              products: {
                orderBy: { order: "asc" },
              },
            },
            orderBy: { createdAt: "desc" },
            take: 10,
          }),
          prisma.forgeSettings.findUnique({ where: { organizationId: orgId } }),
        ]);

      // Valor total de propostas não-rascunho
      const allActiveProposals = await prisma.forgeProposal.findMany({
        where: { organizationId: orgId, status: { not: ForgeProposalStatus.RASCUNHO } },
        include: { products: true },
      });
      let totalProposalValue = 0;
      for (const p of allActiveProposals) {
        totalProposalValue += calcProposalTotal(p.products, p.discount, p.discountType);
      }

      // Valor das propostas pagas (para comissão)
      const paidProposals = allActiveProposals.filter((p) => p.status === ForgeProposalStatus.PAGA);
      let totalPaidValue = 0;
      for (const p of paidProposals) {
        totalPaidValue += calcProposalTotal(p.products, p.discount, p.discountType);
      }

      const commissionPct = Number(settings?.commissionPercentage ?? 0);
      const commissionsGenerated = (totalPaidValue * commissionPct) / 100;

      return {
        proposalsSent,
        activeContracts,
        totalProposalValue: totalProposalValue.toFixed(2),
        proposalsPaid,
        commissionsGenerated: commissionsGenerated.toFixed(2),
        recentProposals: recentProposals.map((p) => ({
          ...p,
          discount: p.discount?.toString() ?? null,
          products: p.products.map((pp) => ({
            ...pp,
            quantity: pp.quantity.toString(),
            unitValue: pp.unitValue.toString(),
            discount: pp.discount?.toString() ?? null,
          })),
        })),
      };
    } catch (err) {
      console.error("[forge/dashboard]", err);
      throw errors.INTERNAL_SERVER_ERROR;
    }
  });
