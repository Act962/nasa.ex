import { SidebarInset } from "@/components/ui/sidebar";
import { CampaignMasterCalendar } from "@/features/nasa-planner/components/campaign-master-calendar";

export default function NasaPlannerCalendarioPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <CampaignMasterCalendar />
    </SidebarInset>
  );
}
