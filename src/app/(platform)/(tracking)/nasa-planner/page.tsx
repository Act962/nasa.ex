import { SidebarInset } from "@/components/ui/sidebar";
import { NasaPlannerListPage } from "@/features/nasa-planner/components/nasa-planner-list";
import { AstroPromptBar } from "@/features/insights/components/astro/astro-prompt-bar";

export default function NasaPlannerPage() {
  return (
    <SidebarInset className="overflow-hidden">
      <div className="flex flex-col h-full w-full">
        <div className="px-4 sm:px-6 pt-4 max-w-7xl mx-auto w-full">
          <AstroPromptBar
            context="planner"
            placeholder="Peça ao Astro: 'cria campanha pra esse conteúdo R$ 50/dia'…"
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <NasaPlannerListPage />
        </div>
      </div>
    </SidebarInset>
  );
}
