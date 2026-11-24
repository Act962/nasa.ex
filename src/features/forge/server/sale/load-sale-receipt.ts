import "server-only";
import prisma from "@/lib/prisma";
import type { SaleReceiptData } from "@/features/forge/components/public/sale-receipt";

/** A descrição do produto pode vir com marcação do editor: no recibo vai só o texto, em uma linha curta. */
function plainTextOrNull(description: string | null): string | null {
  const text = (description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 140) : null;
}

/**
 * O link do recibo é público: o CPF sai do servidor já com o miolo escondido, para o número inteiro
 * não ir no HTML nem no PDF (spec 0148, segurança). CNPJ é dado de empresa e vai inteiro.
 */
function maskClientDocument(document: string | null): string | null {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
  return document;
}

export interface LoadedSaleReceipt {
  receipt: SaleReceiptData & { number: number };
  total: number;
  proposalId: string;
  organizationId: string;
  publicToken: string;
  leadId: string | null;
  trackingId: string | null;
}

/** Recibo de uma venda paga (spec 0148): mesmo conteúdo na página pública e no PDF do Financeiro (spec 0151). */
export async function loadSaleReceipt(where: { publicToken: string } | { id: string }): Promise<LoadedSaleReceipt | null> {
  const proposal = await prisma.forgeProposal.findUnique({
    where,
    select: {
      id: true,
      organizationId: true,
      publicToken: true,
      number: true,
      status: true,
      paidAt: true,
      updatedAt: true,
      paymentMethod: true,
      installments: true,
      discount: true,
      discountType: true,
      organization: {
        select: { name: true, logo: true, cnpj: true, contactPhone: true, addressLine: true, city: true, state: true },
      },
      client: {
        select: {
          id: true,
          trackingId: true,
          name: true,
          document: true,
          addressStreet: true,
          addressNumber: true,
          addressNeighborhood: true,
          addressCity: true,
          addressState: true,
        },
      },
      products: {
        select: { quantity: true, unitValue: true, discount: true, product: { select: { name: true, description: true } } },
        orderBy: { order: "asc" },
      },
    },
  });

  // Recibo só existe para venda paga (spec 0148, CA-7).
  if (!proposal || proposal.status !== "PAGA") return null;

  const items = proposal.products.map((line) => ({
    name: line.product.name,
    description: plainTextOrNull(line.product.description),
    quantity: Number(line.quantity),
    unitValue: Number(line.unitValue),
    discount: Number(line.discount ?? 0),
  }));
  const itemsNet = items.reduce((sum, item) => sum + item.quantity * item.unitValue - item.discount, 0);
  const proposalDiscount = proposal.discount
    ? proposal.discountType === "PERCENTUAL"
      ? itemsNet * (Number(proposal.discount) / 100)
      : Number(proposal.discount)
    : 0;

  const client = proposal.client;
  const clientAddress = client
    ? [
        [client.addressStreet, client.addressNumber].filter(Boolean).join(", "),
        client.addressNeighborhood,
        [client.addressCity, client.addressState].filter(Boolean).join(" - "),
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return {
    receipt: {
      number: proposal.number,
      paidAt: (proposal.paidAt ?? proposal.updatedAt).toISOString(),
      paymentMethod: proposal.paymentMethod,
      installments: proposal.installments,
      proposalDiscount,
      organization: proposal.organization,
      client: client ? { name: client.name, document: maskClientDocument(client.document), address: clientAddress || null } : null,
      items,
    },
    total: itemsNet - proposalDiscount,
    proposalId: proposal.id,
    organizationId: proposal.organizationId,
    publicToken: proposal.publicToken,
    leadId: client?.id ?? null,
    trackingId: client?.trackingId ?? null,
  };
}
