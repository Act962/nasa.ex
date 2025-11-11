import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { client, orpc } from "@/lib/orpc";
import { ListColumn } from "@/features/tracking/components/kamban/list-column";

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
    <div className="">
      <header>{tracking.name}</header>
      <div className="w-full h-full relative ">
        <HydrateClient client={queryClient}>
          <ListColumn />
        </HydrateClient>
      </div>
    </div>
  );
}
