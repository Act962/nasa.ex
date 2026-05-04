import { SidebarInset } from "@/components/ui/sidebar";
import { NasaRouteHome } from "@/features/nasa-route/components/student/nasa-route-home";

export default function NasaRoutePage() {
  return (
    <SidebarInset className="overflow-x-hidden">
      <NasaRouteHome />
    </SidebarInset>
  );
}
