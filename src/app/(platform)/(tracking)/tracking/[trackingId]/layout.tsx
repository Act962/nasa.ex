import { SidebarInset } from "@/components/ui/sidebar";
import { NavTracking } from "../../_components/nav-tracking";
import { FiltersTracking } from "./_components/filters-tracking";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarInset className="h-screen">
      <NavTracking />
      <FiltersTracking />
      {children}
    </SidebarInset>
  );
}
