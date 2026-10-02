import { CreatorDashboard } from "@/features/nasa-route/components/creator/creator-dashboard";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";
import { NasaRouteShell } from "@/features/nasa-route/components/shared/nasa-route-shell";

export default function CreatorPage() {
  return (
    <NasaRouteShell>
      <AppPinnedInsightsStrip appModule="nasa-route" />
      <CreatorDashboard />
    </NasaRouteShell>
  );
}
