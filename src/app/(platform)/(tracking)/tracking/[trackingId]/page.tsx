import { KanbanBoardTracking } from "@/features/tracking/components/kamban/_layout";
import { getQueryClient } from "@/lib/query/hydration";
import { client, orpc } from "@/lib/orpc";

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
    <div className="h-full ">
      <header> {tracking.name} </header>

      <KanbanBoardTracking />
    </div>
  );
}
