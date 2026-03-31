import { HeaderTracking } from "@/features/leads/components/header-tracking";

import { Suspense } from "react";
import {
  AgendaContainer,
  AgendaList,
  SkeletonAgendaList,
} from "@/features/agenda/components/agenda";
import { WorkspaceContainer } from "@/features/workspace/components/workspaces";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking title="Workspaces" />
      <WorkspaceContainer />
    </div>
  );
}
