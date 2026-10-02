import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { BroadcastDetail } from "@/features/campanhas/components/broadcast-detail";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ broadcastId: string }>;
}) {
  const { broadcastId } = await params;
  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <BroadcastDetail broadcastId={broadcastId} />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
