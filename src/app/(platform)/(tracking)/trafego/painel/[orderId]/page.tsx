import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { TrafegoOrderDetail } from "@/features/trafego/components/panel/order-detail";

export default async function TrafegoOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <SidebarInset className="overflow-hidden">
      <HeaderTracking title="trafeGO" />
      <div className="flex-1 overflow-auto">
        <TrafegoOrderDetail orderId={orderId} />
      </div>
    </SidebarInset>
  );
}
