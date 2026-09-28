import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { ContactsView } from "@/features/campanhas/components/contacts-view";

export default function CampanhasContatosPage() {
  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <ContactsView />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
