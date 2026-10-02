import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { AnalyticsView } from "@/features/campanhas/components/analytics-view";

export default function CampanhasAnalyticsPage() {
  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <AnalyticsView />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
