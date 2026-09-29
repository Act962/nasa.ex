import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { requireAppPermission } from "@/app/middlewares/app-permission";
import { base } from "@/app/middlewares/base";
import { catalogOrderItemSchema } from "@/features/nerp-catalog/schemas/order-payload";
import type {
  CatalogOrderStatus,
  ForgeContractStatus,
  ForgeProposalStatus,
} from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import z from "zod";

// Compras do lead: pedidos do Catálogo online + propostas pagas/contratadas do Forge.

const PAID_CATALOG_ORDER_STATUSES: CatalogOrderStatus[] = [
  "PAID",
  "IN_LOGISTICS",
  "DELIVERED",
];

const catalogOrderItemsSchema = z.array(catalogOrderItemSchema);

type ForgeProposalTotalInput = {
  discount: { toNumber: () => number } | null;
  discountType: string | null;
  products: {
    quantity: { toNumber: () => number };
    unitValue: { toNumber: () => number };
    discount: { toNumber: () => number } | null;
  }[];
};

function toForgeItemTotal(item: ForgeProposalTotalInput["products"][number]) {
  return (
    item.quantity.toNumber() * item.unitValue.toNumber() -
    (item.discount?.toNumber() ?? 0)
  );
}

function toForgeProposalTotal(proposal: ForgeProposalTotalInput): number {
  let subtotal = proposal.products.reduce(
    (sum, item) => sum + toForgeItemTotal(item),
    0,
  );
  if (proposal.discount) {
    const proposalDiscount = proposal.discount.toNumber();
    subtotal =
      proposal.discountType === "PERCENTUAL"
        ? subtotal * (1 - proposalDiscount / 100)
        : subtotal - proposalDiscount;
  }
  return Math.max(0, subtotal);
}

export const listLeadProducts = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .use(requireAppPermission("lead-produtos", "canView"))
  .route({
    method: "GET",
    path: "/leads/:leadId/products",
    summary: "List products/services purchased by a lead",
    tags: ["Leads"],
  })
  .input(z.object({ leadId: z.string() }))
  .handler(async ({ input, context, errors }) => {
    const lead = await prisma.lead.findFirst({
      where: {
        id: input.leadId,
        tracking: { organizationId: context.org.id },
      },
      select: { id: true },
    });
    if (!lead) throw errors.NOT_FOUND({ message: "Lead não encontrado" });

    const [catalogOrderRows, forgeProposalRows] = await Promise.all([
      prisma.catalogOrder.findMany({
        where: { leadId: lead.id, organizationId: context.org.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          nerpSaleNumber: true,
          status: true,
          createdAt: true,
          paidAt: true,
          total: true,
          items: true,
        },
      }),
      prisma.forgeProposal.findMany({
        where: {
          clientId: lead.id,
          organizationId: context.org.id,
          isTemplate: false,
          OR: [{ status: "PAGA" }, { contracts: { some: { status: "ATIVO" } } }],
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          number: true,
          title: true,
          status: true,
          updatedAt: true,
          discount: true,
          discountType: true,
          contracts: {
            orderBy: { startDate: "desc" },
            take: 1,
            select: { status: true, startDate: true, value: true },
          },
          products: {
            orderBy: { order: "asc" },
            select: {
              quantity: true,
              unitValue: true,
              discount: true,
              product: { select: { name: true, imageUrl: true } },
            },
          },
        },
      }),
    ]);

    const catalogOrders = catalogOrderRows.map((order) => {
      const parsedItems = catalogOrderItemsSchema.safeParse(order.items);
      return {
        id: order.id,
        saleNumber: order.nerpSaleNumber,
        status: order.status,
        isPaid: PAID_CATALOG_ORDER_STATUSES.includes(order.status),
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString() ?? null,
        total: order.total.toNumber(),
        items: parsedItems.success
          ? parsedItems.data.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
              imageUrl: item.imageUrl,
            }))
          : [],
      };
    });

    const forge = forgeProposalRows.map((proposal) => {
      const latestContract = proposal.contracts[0] ?? null;
      const contractStatus: ForgeContractStatus | null =
        latestContract?.status ?? null;
      const proposalStatus: ForgeProposalStatus = proposal.status;
      const purchasedAt =
        contractStatus === "ATIVO" && latestContract
          ? latestContract.startDate
          : proposal.updatedAt;
      return {
        proposalId: proposal.id,
        number: proposal.number,
        title: proposal.title,
        status: proposalStatus,
        contractStatus,
        purchasedAt: purchasedAt.toISOString(),
        total: toForgeProposalTotal(proposal),
        items: proposal.products.map((item) => ({
          name: item.product.name,
          quantity: item.quantity.toNumber(),
          unitValue: item.unitValue.toNumber(),
          discount: item.discount?.toNumber() ?? 0,
          total: toForgeItemTotal(item),
          imageUrl: item.product.imageUrl,
        })),
      };
    });

    const paidCatalogOrders = catalogOrders.filter((order) => order.isPaid);
    const purchaseDates = [
      ...paidCatalogOrders.map((order) => order.paidAt ?? order.createdAt),
      ...forge.map((proposal) => proposal.purchasedAt),
    ].sort();

    return {
      catalogOrders,
      forge,
      totals: {
        purchasesCount: paidCatalogOrders.length + forge.length,
        totalSpent:
          paidCatalogOrders.reduce((sum, order) => sum + order.total, 0) +
          forge.reduce((sum, proposal) => sum + proposal.total, 0),
        lastPurchaseAt: purchaseDates.at(-1) ?? null,
      },
    };
  });
