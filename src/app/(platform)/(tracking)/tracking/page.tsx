import Heading from "../_components/heading";

import { SidebarHeader, SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "../_components/header-tracking";
import { TrackingList } from "../_components/tracking-list";
import { prefetchTrackings } from "@/features/trackings/server/prefetch";
import { HydrateClient } from "@/trpc/server";

export default async function TrackingPage() {
  prefetchTrackings();

  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking />
      <div className="h-full px-4">
        <HydrateClient>
          <Heading />

          <TrackingList />
        </HydrateClient>
      </div>
    </SidebarInset>
  );
}
