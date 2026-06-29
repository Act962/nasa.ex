import { InsightsSidebar } from "@/features/insights/components/insights-sidebar";
import { ActivitiesPanel } from "@/features/insights/components/activities/activities-panel";

export default function AtividadesPage() {
  return (
    <div className="flex h-full w-full">
      <InsightsSidebar />
      <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6">
        <ActivitiesPanel />
      </div>
    </div>
  );
}
