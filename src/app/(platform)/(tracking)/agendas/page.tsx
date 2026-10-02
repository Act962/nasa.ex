import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { ASTRO_COMMAND_EXAMPLES } from "@/features/astro-commander/lib/command-examples";

import { Suspense } from "react";
import {
  AgendaContainer,
  AgendaList,
  SkeletonAgendaList,
} from "@/features/agenda/components/agenda";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function Page() {
  return (
    <div className="h-full w-full">
      <HeaderTracking
        title="Agendas"
        isTitleHidden
        astroCommand={{ examples: ASTRO_COMMAND_EXAMPLES.agenda, isHiddenOnMobile: true }}
      />
      <AppPinnedInsightsStrip appModule="spacetime" />
      <AgendaContainer>
        <Suspense fallback={<SkeletonAgendaList />}>
          <AgendaList />
        </Suspense>
      </AgendaContainer>
    </div>
  );
}
