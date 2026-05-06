import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { MetaTrafficReport } from "@/features/insights/components/full-reports/meta-traffic-report";

export default function RelatorioTrafegoMetaPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="flex-1 overflow-auto">
        <MetaTrafficReport />
      </div>
    </div>
  );
}
