import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { NewTemplateView } from "@/features/campanhas/components/templates/new-template-view";

type NewTemplatePageProps = {
  searchParams: Promise<{ trackingId?: string; preset?: string }>;
};

export default async function NewCampanhaTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const { trackingId, preset } = await searchParams;

  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <NewTemplateView trackingId={trackingId} presetId={preset} />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
