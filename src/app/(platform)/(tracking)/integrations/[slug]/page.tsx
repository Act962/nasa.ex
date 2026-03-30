import { notFound } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { IntegrationHubPage } from "@/features/integrations/components/marketplace/integration-hub-page";
import { getIntegrationBySlug } from "@/data/integrations";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const integration = getIntegrationBySlug(slug);

  if (!integration || !integration.hubPageEnabled) {
    notFound();
  }

  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        <IntegrationHubPage integration={integration} />
      </div>
    </SidebarInset>
  );
}
