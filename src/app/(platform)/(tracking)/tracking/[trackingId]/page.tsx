import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";
import { z } from "zod";
import dayjs from "dayjs";
import { prefetchStatus } from "@/features/status/server/prefetch";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
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
  const queryClient = getQueryClient();
  const search = await searchParams;

  const {
    participant,
    date_init: dateInit,
    date_end: dateEnd,
  } = filterSchema.parse(search);

  await prefetchStatus(queryClient, {
    trackingId,
    date_init: dateInit ? dayjs(dateInit).startOf("day").toDate() : undefined,
    date_end: dateEnd ? dayjs(dateEnd).endOf("day").toDate() : undefined,
    participant,
  });

  return (
    <>
      <FiltersTracking />
      <div className="relative h-full overflow-x-auto scroll-cols-tracking ">
        <HydrateClient client={queryClient}>
          <ListContainer trackingId={trackingId} />
        </HydrateClient>
      </div>
    </>
  );
}
