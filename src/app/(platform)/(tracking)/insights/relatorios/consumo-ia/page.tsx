import { AiConsumptionReport } from "@/features/ia/components/ai-consumption-report";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { HeaderTracking } from "@/features/leads/components/header-tracking";

export default function RelatorioConsumoIaPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="flex-1 overflow-auto">
        <AiConsumptionReport />
      </div>
    </div>
  );
}
