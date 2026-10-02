import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { BroadcastsList } from "@/features/campanhas/components/broadcasts-list";
import { IncomingSelectionBanner } from "@/features/campanhas/components/incoming-selection-banner";
import { Suspense } from "react";

export default function CampanhasPage() {
  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
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
