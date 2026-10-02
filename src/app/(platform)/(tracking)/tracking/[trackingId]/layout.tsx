import { SidebarInset } from "@/components/ui/sidebar";
import { NavTracking } from "@/features/trackings/components/nav-tracking";
import { TrackingOrbitDock } from "@/features/trackings/components/tracking-orbit-dock";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset className="h-screen">
      <NavTracking />
      {children}
      <TrackingOrbitDock />
    </SidebarInset>
  );
}
