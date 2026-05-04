import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { ActivitiesPanel } from "@/features/insights/components/activities/activities-panel";

export default function AtividadesPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        <ActivitiesPanel />
      </div>
    </div>
  );
}
