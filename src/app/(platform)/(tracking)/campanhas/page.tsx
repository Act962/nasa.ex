import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { BroadcastsList } from "@/features/campanhas/components/broadcasts-list";
import { IncomingSelectionBanner } from "@/features/campanhas/components/incoming-selection-banner";
import { Suspense } from "react";

export default function CampanhasPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <Suspense fallback={null}>
            <IncomingSelectionBanner />
          </Suspense>
          <BroadcastsList />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
