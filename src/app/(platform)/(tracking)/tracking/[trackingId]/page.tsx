import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ListColumn } from "@/features/tracking/components/kamban/list-column";

type TrackingPageProps = {
  params: Promise<{ trackingId: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { trackingId } = await params;
  const tracking = await prisma.tracking.findUnique({
    where: {
      id: trackingId,
    },
  });

  if (!tracking) {
    notFound();
  }

  return (
    <div className="h-full ">
      <header>{tracking.name}</header>
      <div className="w-full h-full relative ">
        <ListColumn />
      </div>
    </div>
  );
}
