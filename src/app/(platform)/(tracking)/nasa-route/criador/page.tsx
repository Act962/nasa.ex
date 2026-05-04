import { CreatorDashboard } from "@/features/nasa-route/components/creator/creator-dashboard";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function CreatorPage() {
  return (
    <>
      <AppPinnedInsightsStrip appModule="nasa-route" />
      <CreatorDashboard />
    </>
  );
}
