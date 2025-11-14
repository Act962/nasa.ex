import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ListContainer } from "../../_components/kanbam/list-container";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "../../_components/header-tracking";
import { NavTracking } from "../../_components/nav-tracking";

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

  return (
    <SidebarInset className="h-screen">
      <NavTracking />
      <div className="px-4 h-full overflow-x-auto scroll-cols-tracking">
        <HydrateClient client={queryClient}>
          <ListContainer trackingId={trackingId} />
        </HydrateClient>
      </div>
    </SidebarInset>
  );
}
