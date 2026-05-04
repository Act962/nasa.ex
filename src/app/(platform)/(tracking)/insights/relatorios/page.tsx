import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { InsightsTabsNav } from "@/features/insights/components/insights-tabs-nav";
import { ReportsList } from "@/features/insights/components/reports/reports-list";

export default function RelatoriosPage() {
  return (
    <div className="flex flex-col h-full w-full">
      <HeaderTracking title="Insights" />
      <InsightsTabsNav />
      <div className="flex-1 overflow-auto px-4 sm:px-6 py-6 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-xl font-bold">Relatórios salvos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Snapshots congelados dos seus dashboards. Compartilhe via link
            público ou compare com relatórios anteriores.
          </p>
        </div>
        <ReportsList />
      </div>
    </div>
  );
}
