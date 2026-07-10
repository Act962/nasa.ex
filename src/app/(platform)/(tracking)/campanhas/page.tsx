import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { BroadcastsList } from "@/features/campanhas/components/broadcasts-list";

export default function CampanhasPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <BroadcastsList />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
