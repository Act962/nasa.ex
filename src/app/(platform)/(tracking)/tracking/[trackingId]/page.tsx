import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";
import { ErrorBoundary } from "react-error-boundary";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { SearchParams } from "nuqs";
import { statusParamsLoader } from "@/features/status/server/params-loader";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<SearchParams>;
};

export default async function TrackingPage({
  params,
  searchParams,
}: TrackingPageProps) {
  const { trackingId } = await params;

  const queryParams = await statusParamsLoader(searchParams);

  prefetch(
    trpc.status.list.queryOptions({
      trackingId,
      date_init: queryParams.date_init,
      date_end: queryParams.date_end,
      participant: queryParams.participant,
    })
  );

  return (
    <>
      <FiltersTracking />
      <HydrateClient>
        <ErrorBoundary fallback={<div>Something went wrong</div>}>
          <Suspense fallback={<div>Loading...</div>}>
            <div className="relative h-full overflow-x-auto scroll-cols-tracking ">
              <ListContainer trackingId={trackingId} />
            </div>
          </Suspense>
        </ErrorBoundary>
      </HydrateClient>
    </>
  );
}
