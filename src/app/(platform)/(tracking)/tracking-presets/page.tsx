import { SidebarInset } from "@/components/ui/sidebar";
import { TrackingPresetsCatalog } from "@/features/tracking-presets/components/tracking-presets-catalog";
import { Sparkles } from "lucide-react";

/**
 * Catálogo público de Padrões de Tracking. Acessível pra qualquer user
 * autenticado na org. Apresenta presets curados pela NASA agrupados por
 * paradigma (Reativo/Proativo/Preditivo/Autoatendimento).
 *
 * Click num card abre `<ApplyPresetDialog>` com fluxo de 3 steps.
 */
export default function TrackingPresetsPage() {
  return (
    <SidebarInset className="overflow-y-auto">
      <div className="container mx-auto max-w-6xl p-6">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <Sparkles className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wide">
              Padrões NASA
            </span>
          </div>
          <h1 className="text-2xl font-bold">Padrões de Tracking</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Comece com um catálogo curado de fluxos prontos. Cada padrão cria
            tracking + status + tags + automações funcionais — sem precisar
            configurar do zero.
          </p>
        </header>

        <TrackingPresetsCatalog />
      </div>
    </SidebarInset>
  );
}
