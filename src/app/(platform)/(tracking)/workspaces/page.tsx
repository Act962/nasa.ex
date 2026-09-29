import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";

import { WorkspaceContainer } from "@/features/workspace/components/workspaces";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking
        title="Workspaces"
        astroCommand={{ examples: ASTRO_COMMAND_EXAMPLES.workspace }}
      />
      <AppPinnedInsightsStrip appModule="workspace" />
      <WorkspaceContainer />
    </div>
  );
}
