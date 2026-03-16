import { HeaderTracking } from "@/features/leads/components/header-tracking";

import { Suspense } from "react";
import {
  AgendaContainer,
  AgendaList,
  SkeletonAgendaList,
} from "@/features/agenda/components/agenda";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <AgendaContainer>
        <Suspense fallback={<SkeletonAgendaList />}>
          <AgendaList />
        </Suspense>
      </AgendaContainer>
    </div>
  );
}
