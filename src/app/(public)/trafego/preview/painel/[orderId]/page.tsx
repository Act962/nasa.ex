import { TrafegoOrderDetail } from "@/features/trafego/components/panel/order-detail";

export default async function PreviewPainelDetalhePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <TrafegoOrderDetail orderId={orderId} />;
}
