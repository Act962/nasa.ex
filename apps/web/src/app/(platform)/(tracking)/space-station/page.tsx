import { SidebarInset } from "@/components/ui/sidebar";
import { SpaceStationAdmin } from "@/features/space-station/admin/space-station-admin";

export default function SpaceStationPage() {
  return (
    <SidebarInset>
      <div className="p-6 overflow-y-auto h-full">
        <SpaceStationAdmin />
      </div>
    </SidebarInset>
  );
}
