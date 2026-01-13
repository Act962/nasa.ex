import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function TrackingPage({
  params,
  searchParams,
}: TrackingPageProps) {
  const { trackingId } = await params;

  return (
    <>
      <FiltersTracking />
      <div className="relative h-full overflow-x-auto scroll-cols-tracking ">
        <ListContainer trackingId={trackingId} />
      </div>
    </>
  );
}
