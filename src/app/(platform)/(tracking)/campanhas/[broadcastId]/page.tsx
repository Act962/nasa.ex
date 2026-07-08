import { SidebarInset } from "@/components/ui/sidebar";
import { BroadcastDetail } from "@/features/campanhas/components/broadcast-detail";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ broadcastId: string }>;
}) {
  const { broadcastId } = await params;
  return (
    <SidebarInset className="min-h-full pb-8">
      <BroadcastDetail broadcastId={broadcastId} />
    </SidebarInset>
  );
}
