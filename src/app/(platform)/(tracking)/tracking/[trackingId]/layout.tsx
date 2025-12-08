import { SidebarInset } from "@/components/ui/sidebar";
import { NavTracking } from "../../_components/nav-tracking";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset className="h-screen">
      <NavTracking />
      {children}
    </SidebarInset>
  );
}
