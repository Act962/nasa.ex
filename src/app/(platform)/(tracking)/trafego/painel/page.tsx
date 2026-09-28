import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { TrafegoOrdersList } from "@/features/trafego/components/panel/orders-list";

export default function TrafegoPanelPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <HeaderTracking title="trafeGO" />
      <div className="flex-1 overflow-auto">
        <TrafegoOrdersList />
      </div>
    </SidebarInset>
  );
}
