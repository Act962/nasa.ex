import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { BroadcastsList } from "@/features/campanhas/components/broadcasts-list";

export default function CampanhasPage() {
  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking title="Campanhas" />
      <BroadcastsList />
    </SidebarInset>
  );
}
