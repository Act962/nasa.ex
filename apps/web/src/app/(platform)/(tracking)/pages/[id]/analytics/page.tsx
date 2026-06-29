import { PageAnalyticsView } from "@/features/pages/components/analytics/page-analytics-view";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageAnalyticsView pageId={id} />;
}
