import { SidebarInset } from "@/components/ui/sidebar";
import { BroadcastsList } from "@/features/campanhas/components/broadcasts-list";

export default function CampanhasPage() {
  return (
    <SidebarInset className="min-h-full pb-8">
      <BroadcastsList />
    </SidebarInset>
  );
}
