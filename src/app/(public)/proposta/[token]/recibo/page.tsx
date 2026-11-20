import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SaleReceipt, type SaleReceiptData } from "@/features/forge/components/public/sale-receipt";

interface Props {
  params: Promise<{ token: string }>;
}

export const metadata = { robots: { index: false, follow: false } };

/**
 * O link do recibo é público: o CPF sai do servidor já com o miolo escondido, para o número inteiro
 * não ir no HTML da página (spec 0148, segurança). CNPJ é dado de empresa e vai inteiro.
 */
/** A descrição do produto pode vir com marcação do editor: no recibo vai só o texto, em uma linha curta. */
function plainTextOrNull(description: string | null): string | null {
  const text = (description ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 140) : null;
}

function maskClientDocument(document: string | null): string | null {
  if (!document) return null;
  const digits = document.replace(/\D/g, "");
  if (digits.length === 11) return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
  return document;
}

export default async function SaleReceiptPage({ params }: Props) {
  const { token } = await params;
  const proposal = await prisma.forgeProposal.findUnique({
    where: { publicToken: token },
    select: {
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
  if (!proposal || proposal.status !== "PAGA") return notFound();

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

  const receipt: SaleReceiptData = {
    number: proposal.number,
    paidAt: (proposal.paidAt ?? proposal.updatedAt).toISOString(),
    paymentMethod: proposal.paymentMethod,
    installments: proposal.installments,
    proposalDiscount,
    organization: proposal.organization,
    client: client ? { name: client.name, document: maskClientDocument(client.document), address: clientAddress || null } : null,
    items,
  };

  return <SaleReceipt receipt={receipt} />;
}
