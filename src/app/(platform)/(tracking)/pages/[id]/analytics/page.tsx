import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PageAnalyticsView } from "@/features/pages/components/analytics/page-analytics-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="h-full w-full">
      <HeaderTracking title="Visitas e cliques" isTitleHidden />
      <PageAnalyticsView pageId={id} />
    </div>
  );
}
