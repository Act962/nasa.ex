import Heading from "../_components/heading";
import { requireAuth } from "@/lib/auth-utils";

import { TrackingList } from "@/features/tracking/components/tracking-list";
import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";

export default async function TrackingPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(orpc.tracking.list.queryOptions());

  return (
    <div className="h-full px-4 ">
      <Heading />

      <HydrateClient client={queryClient}>
        <TrackingList />
      </HydrateClient>
    </div>
  );
}
