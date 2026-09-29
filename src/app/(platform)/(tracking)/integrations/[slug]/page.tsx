import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { IntegrationHubPage } from "@/features/integrations/components/marketplace/integration-hub-page";
import { getIntegrationBySlug } from "@/data/integrations";
import { NerpIntegrationHub } from "@/features/nerp-catalog/components/nerp-hub/nerp-integration-hub";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const integration = getIntegrationBySlug(slug);

  if (!integration) {
    notFound();
  }

  return (
    <SidebarInset className="min-h-full">
      <HeaderTracking />
      <div className="px-4 pb-8 pt-2">
        {integration.slug === "nerp" ? (
          <Suspense>
            <NerpIntegrationHub />
          </Suspense>
        ) : (
          <IntegrationHubPage integration={integration} />
        )}
      </div>
    </SidebarInset>
  );
}
