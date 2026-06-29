import { SidebarInset } from "@/components/ui/sidebar";
import { LeadContainer } from "../../../../../features/leads/components/lead-container";

type LeadPageProps = {
  params: Promise<{ leadId: string }>;
};

export default async function LeadPage({ params }: LeadPageProps) {
  const { leadId } = await params;

  return (
    <SidebarInset>
      <LeadContainer />
    </SidebarInset>
  );
}
