import { SidebarInset } from "@/components/ui/sidebar";
import { CampanhasTopBar } from "@/features/campanhas/components/campanhas-top-bar";
import { CampanhasShell, CampanhasContent } from "@/features/campanhas/components/campanhas-shell";
import { TemplatesList } from "@/features/campanhas/components/templates/templates-list";

type TemplatesPageProps = {
  searchParams: Promise<{ trackingId?: string }>;
};

export default async function CampanhasTemplatesPage({
  searchParams,
}: TemplatesPageProps) {
  const { trackingId } = await searchParams;

  return (
    <SidebarInset className="min-h-full">
      <CampanhasTopBar />
      <CampanhasShell>
        <CampanhasContent>
          <TemplatesList initialTrackingId={trackingId} />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
