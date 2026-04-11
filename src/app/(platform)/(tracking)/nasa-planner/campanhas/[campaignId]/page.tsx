import { SidebarInset } from "@/components/ui/sidebar";
import { CampaignDetail } from "@/features/nasa-planner/components/campaign-detail";

type Props = {
  params: Promise<{ campaignId: string }>;
};

export default async function CampaignDetailPage({ params }: Props) {
  const { campaignId } = await params;
  return (
    <SidebarInset className="overflow-hidden">
      <CampaignDetail campaignId={campaignId} />
    </SidebarInset>
  );
}
