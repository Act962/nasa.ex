import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { EmailTemplatesView } from "@/features/campanhas/components/email/email-templates-view";

export default function CampanhasEmailTemplatesPage() {
  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <EmailTemplatesView />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
