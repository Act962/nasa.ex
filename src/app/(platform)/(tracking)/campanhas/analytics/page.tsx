import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { AnalyticsView } from "@/features/campanhas/components/analytics-view";

export default function CampanhasAnalyticsPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <AnalyticsView />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
