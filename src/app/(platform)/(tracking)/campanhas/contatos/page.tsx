import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { ContactsView } from "@/features/campanhas/components/contacts-view";

export default function CampanhasContatosPage() {
  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <ContactsView />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
