import { SidebarInset } from "@/components/ui/sidebar";
import { NasaPlannerListPage } from "@/features/nasa-planner/components/nasa-planner-list";

export default function NasaPlannerPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <NasaPlannerListPage />
    </SidebarInset>
  );
}
