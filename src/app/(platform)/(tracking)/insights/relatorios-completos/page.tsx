import { InsightsSidebar } from "@/features/insights/components/insights-sidebar";
import { FullReportsPanel } from "@/features/insights/components/full-reports/full-reports-panel";

export default function RelatoriosCompletosPage() {
  return (
    <div className="flex h-full w-full">
      <InsightsSidebar />
      <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6">
        <FullReportsPanel />
      </div>
    </div>
  );
}
