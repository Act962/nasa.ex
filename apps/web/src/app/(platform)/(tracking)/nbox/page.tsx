import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { NBoxApp } from "@/features/nbox/components/nbox-app";

export default function NBoxPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <NBoxApp />
    </SidebarInset>
  );
}
