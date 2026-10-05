import { SidebarInset } from "@/components/ui/sidebar";
import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { PlannerHome } from "@/features/nasa-planner/components/v2/planner-home";

/** Planner v2 (spec 0058): o calendário de todos os clientes é a tela inicial; marcas e campanhas ficam em /nasa-planner/planners. */
export default function NasaPlannerPage() {
  return (
    <SidebarInset className="overflow-y-auto">
      <HeaderTracking title="Planner" />
      <PlannerHome />
    </SidebarInset>
  );
}
