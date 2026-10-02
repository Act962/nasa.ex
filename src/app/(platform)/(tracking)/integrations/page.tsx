import { Suspense } from "react";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { SatellitesHub } from "@/features/integrations/components/satellites/satellites-hub";

export default function IntegrationsPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        <Suspense>
          <SatellitesHub />
        </Suspense>
      </div>
    </SidebarInset>
  );
}
