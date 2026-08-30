import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { NewTemplateView } from "@/features/campanhas/components/templates/new-template-view";

type NewTemplatePageProps = {
  searchParams: Promise<{ trackingId?: string }>;
};

export default async function NewCampanhaTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const { trackingId } = await searchParams;

  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <NewTemplateView trackingId={trackingId} />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
