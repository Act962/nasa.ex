import { TrafegoOrderAdminDetail } from "@/features/admin/components/trafego/order-detail";

export default async function PreviewAdminDetalhePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <TrafegoOrderAdminDetail orderId={orderId} />;
}
