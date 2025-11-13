import Heading from "../_components/heading";
import { requireAuth } from "@/lib/auth-utils";

import { TrackingList } from "@/features/tracking/components/tracking-list";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { SidebarHeader, SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "../_components/header-tracking";

export default async function TrackingPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(orpc.tracking.list.queryOptions());

  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking />
      <div className="h-full px-4">
        <Heading />

        <HydrateClient client={queryClient}>
          <TrackingList />
        </HydrateClient>
      </div>
    </SidebarInset>
  );
}
