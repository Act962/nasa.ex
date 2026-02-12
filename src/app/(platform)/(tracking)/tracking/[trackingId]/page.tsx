import { ListContainer } from "./_components/kanbam/list-container";
import { FiltersTracking } from "./_components/filters";
import { BoardContainer } from "@/features/trackings/components/board-container";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { trackingId } = await params;

  return (
    <>
      <FiltersTracking />
      <div className="relative h-full overflow-x-auto scroll-cols-tracking ">
        <BoardContainer trackingId={trackingId} />
      </div>
    </>
  );
}
