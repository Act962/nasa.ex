import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { FullReportsPanel } from "@/features/insights/components/full-reports/full-reports-panel";

export default function RelatoriosCompletosPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        <FullReportsPanel />
      </div>
    </div>
  );
}
