import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
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
      <HeaderTracking title="Campanhas" />
      <CampanhasShell>
        <CampanhasContent>
          <TemplatesList initialTrackingId={trackingId} />
        </CampanhasContent>
      </CampanhasShell>
    </SidebarInset>
  );
}
