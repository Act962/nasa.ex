import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { client, orpc } from "@/lib/orpc";
import { ListColumn } from "@/features/tracking/components/kamban/list-column";
import { ListContainer } from "../../_components/kanbam/list-container";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { trackingId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
      },
    })
  );

  const { tracking } = await client.tracking.get({
    trackingId,
  });

  return (
    <div className="p-4 h-full overflow-x-auto scroll-cols-tracking">
      <HydrateClient client={queryClient}>
        <ListContainer trackingId={trackingId} />
      </HydrateClient>
    </div>
  );
}
