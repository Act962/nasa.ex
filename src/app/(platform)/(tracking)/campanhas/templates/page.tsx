import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { CampanhasNav } from "@/features/campanhas/components/campanhas-nav";
import { TemplatesList } from "@/features/campanhas/components/templates/templates-list";

type TemplatesPageProps = {
  searchParams: Promise<{ trackingId?: string }>;
};

export default async function CampanhasTemplatesPage({
  searchParams,
}: TemplatesPageProps) {
  const { trackingId } = await searchParams;

  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking title="Campanhas" />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
        <CampanhasNav />
        <div className="mt-6">
          <TemplatesList initialTrackingId={trackingId} />
        </div>
      </div>
    </SidebarInset>
  );
}
