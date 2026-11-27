import type { Metadata } from "next";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SaleReceipt } from "@/features/forge/components/public/sale-receipt";
import { loadSaleReceipt } from "@/features/forge/server/sale/load-sale-receipt";

interface Props {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const proposal = await prisma.forgeProposal.findUnique({
    where: { publicToken: token },
    select: { number: true, status: true, organization: { select: { name: true } } },
  });
  const title = proposal?.status === "PAGA" ? `Recibo ${String(proposal.number).padStart(4, "0")} - ${proposal.organization.name}` : "Recibo";
  return { title, robots: { index: false, follow: false } };
}

export default async function SaleReceiptPage({ params }: Props) {
  const { token } = await params;
  const loaded = await loadSaleReceipt({ publicToken: token });
  if (!loaded) return notFound();
  return <SaleReceipt receipt={loaded.receipt} />;
}
