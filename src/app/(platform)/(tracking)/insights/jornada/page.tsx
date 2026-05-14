import { InsightsSidebar } from "@/features/insights/components/insights-sidebar";
import { JornadaPanel } from "@/features/insights/components/jornada/jornada-panel";

export default function JornadaPage() {
  return (
    <div className="flex h-full w-full">
      <InsightsSidebar />
      <div className="flex-1 min-w-0 overflow-auto px-4 sm:px-6 py-6">
        <JornadaPanel />
      </div>
    </div>
  );
}
