import { WhatsAppAnalyticsGuard } from "@/features/whatsapp-analytics/components/whatsapp-analytics-guard";
import { WhatsAppAnalyticsDashboard } from "@/features/whatsapp-analytics/components/whatsapp-analytics-dashboard";

type WhatsAppAnalyticsPageProps = {
  params: Promise<{ trackingId: string }>;
};

export default async function Page({ params }: WhatsAppAnalyticsPageProps) {
  const { trackingId } = await params;

  return (
    <div className="w-full p-6">
      <WhatsAppAnalyticsGuard trackingId={trackingId}>
        <WhatsAppAnalyticsDashboard trackingId={trackingId} />
      </WhatsAppAnalyticsGuard>
    </div>
  );
}
