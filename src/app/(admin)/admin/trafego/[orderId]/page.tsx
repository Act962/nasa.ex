import { TrafegoOrderAdminDetail } from "@/features/admin/components/trafego/order-detail";

export default async function AdminTrafegoOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  return <TrafegoOrderAdminDetail orderId={orderId} />;
}
