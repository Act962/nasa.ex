import { HeaderTracking } from "@/features/leads/components/header-tracking";

import { WorkspaceContainer } from "@/features/workspace/components/workspaces";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking title="Workspaces" />
      <AppPinnedInsightsStrip appModule="workspace" />
      <WorkspaceContainer />
    </div>
  );
}
