import { getQueryClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";
import { z } from "zod";
import dayjs from "dayjs";
import { prefetchStatus } from "@/features/status/server/prefetch";
import { ErrorBoundary } from "react-error-boundary";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { SearchParams } from "nuqs";
import { statusParamsLoader } from "@/features/status/server/params-loader";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<SearchParams>;
};

const filterSchema = z.object({
  participant: z.email().optional(),
  tags: z.string().optional(),
  date_init: z.string().optional(),
  date_end: z.string().optional(),
});

export default async function TrackingPage({
  params,
  searchParams,
}: TrackingPageProps) {
  const { trackingId } = await params;

  const queryParams = await statusParamsLoader(searchParams);

  // await prefetchStatus(queryClient, {
  //   trackingId,
  //   date_init: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
  //   date_end: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
  //   participant,
  // });

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

  // return (
  //   <>
  //     <FiltersTracking />
  //     <div className="relative h-full overflow-x-auto scroll-cols-tracking ">
  //       <HydrateClient client={queryClient}>
  //         <ListContainer trackingId={trackingId} />
  //       </HydrateClient>
  //     </div>
  //   </>
  // );
}
