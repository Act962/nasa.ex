import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TransferPublicView } from "@/features/nbox/components/transfer-public-view";
import { getPublicNboxTransfer } from "@/features/nbox/server/transfers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arquivos enviados pelo ÓRBITA",
  robots: { index: false, follow: false },
};

export default async function TransferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const transfer = await getPublicNboxTransfer(token);
  if (!transfer) notFound();
  return <TransferPublicView token={token} transfer={transfer} />;
}
