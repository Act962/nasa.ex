import { HeaderTracking } from "@/features/leads/components/header-tracking";

import { Suspense } from "react";
import {
  AgendaContainer,
  AgendaList,
} from "@/features/agenda/components/agenda";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <AgendaContainer>
        <Suspense fallback={<div>Loading...</div>}>
          <AgendaList />
        </Suspense>
      </AgendaContainer>
    </div>
  );
}
