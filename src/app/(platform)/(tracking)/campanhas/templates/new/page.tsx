import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { NewTemplateView } from "@/features/campanhas/components/templates/new-template-view";

type NewTemplatePageProps = {
  searchParams: Promise<{ trackingId?: string }>;
};

export default async function NewCampanhaTemplatePage({
  searchParams,
}: NewTemplatePageProps) {
  const { trackingId } = await searchParams;

  return (
    <SidebarInset className="min-h-full pb-8">
      <HeaderTracking title="Campanhas" />
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8">
        <NewTemplateView trackingId={trackingId} />
      </div>
    </SidebarInset>
  );
}
