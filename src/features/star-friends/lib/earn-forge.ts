import "server-only";
import prisma from "@/lib/prisma";
import { awardPurchaseStars } from "./earn";

export async function awardStarFriendsForProposal(
  proposalId: string,
  organizationId: string,
  leadId: string,
) {
  const proposal = await prisma.forgeProposal.findFirst({
    where: { id: proposalId, organizationId },
    select: {
      number: true,
      title: true,
      discount: true,
      discountType: true,
      products: {
        select: {
          quantity: true,
          unitValue: true,
          discount: true,
          product: { select: { name: true } },
        },
      },
    },
  });
  if (!proposal) return;

  const items = proposal.products.map((line) => {
    const lineTotal =
      Number(line.quantity) * Number(line.unitValue) - Number(line.discount ?? 0);
    return { name: line.product.name, quantity: Number(line.quantity), total: lineTotal };
  });
  const subtotal = items.reduce((total, item) => total + item.total, 0);
  const proposalDiscount = Number(proposal.discount ?? 0);
  const amount =
    proposal.discountType === "PERCENTUAL"
      ? subtotal * (1 - proposalDiscount / 100)
      : subtotal - proposalDiscount;

  await awardPurchaseStars({
    organizationId,
    source: "FORGE_PROPOSAL",
    sourceId: proposalId,
    leadId,
    amount,
    items,
    purchaseLabel: `Proposta #${proposal.number} — ${proposal.title}`,
  });
}
