import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadPublicCharge } from "@/features/payment/server/charges/charge-details";
import { PublicChargeView } from "@/features/payment/components/charges/public-charge-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  const charge = await loadPublicCharge(token);
  if (!charge) notFound();
  return <PublicChargeView charge={charge} />;
}
