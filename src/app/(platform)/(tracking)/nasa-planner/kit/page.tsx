import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { BrandKitPage } from "@/features/nasa-planner/components/brand-kit/brand-kit-page";

/** Kit da Marca por cliente (spec 0063). */
export default function NasaPlannerBrandKitPage() {
  return (
    <SidebarInset className="overflow-y-auto">
      <HeaderTracking title="Kit da Marca" />
      <BrandKitPage />
    </SidebarInset>
  );
}
