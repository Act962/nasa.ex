import { HeaderTracking } from "@/features/leads/components/header-tracking";

import { WorkspaceContainer } from "@/features/workspace/components/workspaces";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking title="Workspaces" />
      <WorkspaceContainer />
    </div>
  );
}
