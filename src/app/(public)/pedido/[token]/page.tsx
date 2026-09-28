import type { Metadata } from "next";
import { OrderPortal } from "@/features/nerp-catalog/components/order-portal/order-portal";

export const metadata: Metadata = {
  title: "Acompanhe seu pedido",
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function Page({ params }: Props) {
  const { token } = await params;
  return <OrderPortal token={token} />;
}
