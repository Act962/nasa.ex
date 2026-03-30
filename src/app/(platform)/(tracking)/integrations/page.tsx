import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { IntegrationsMarketplace } from "@/features/integrations/components/marketplace/integrations-marketplace";

export default function IntegrationsPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        <IntegrationsMarketplace />
      </div>
    </SidebarInset>
  );
}
