import { getQueryClient, HydrateClient } from "@/lib/query/hydration";
import { orpc } from "@/lib/orpc";
import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";
import { z } from "zod";
import dayjs from "dayjs";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

const filterSchema = z.object({
  participant: z.string().optional(),
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
    tags,
    date_init: dateInit,
    date_end: dateEnd,
  } = filterSchema.parse(search);

  await queryClient.prefetchQuery(
    orpc.status.list.queryOptions({
      input: {
        trackingId,
        date_init: dateInit ? dayjs(dateInit).toDate() : undefined,
        date_end: dateEnd ? dayjs(dateEnd).toDate() : undefined,
      },
    })
  );

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
