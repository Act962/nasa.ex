"use client";

import { Wand2 } from "lucide-react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApplyDefaultCatalogStages } from "../../hooks/use-nerp-catalog-integration";
import { CATALOG_STAGES } from "../../lib/catalog-stages";

// Spec 0044, RF-4: empresa já existente adota as etapas padrão do pedido num tracking escolhido.
type AppliedStages = { trackingId: string; ordersStatusId: string; logisticsStatusId: string };

export function ApplyDefaultStagesCard({
  trackingId,
  trackingName,
  isEnabled,
  onApplied,
}: {
  trackingId: string;
  trackingName: string | null;
  isEnabled: boolean;
  /** O formulário passa a mostrar o que foi gravado — sem isso, "Salvar" regravaria a configuração antiga. */
  onApplied: (applied: AppliedStages) => void;
}) {
  const applyDefaultStages = useApplyDefaultCatalogStages();

  const handleApply = () => {
    applyDefaultStages.mutate(
      { trackingId },
      {
        onSuccess: (result) => {
          onApplied(result);
          toast.success(`Padrão aplicado em "${result.trackingName}". Os pedidos passam a andar só por ele.`);
        },
        onError: (error) => toast.error(error.message || "Não foi possível aplicar o padrão."),
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed p-3">
      <div>
        <p className="text-sm font-medium">Padrão do sistema para pedidos</p>
        <p className="text-xs text-muted-foreground">
          Cria {trackingName ? `em "${trackingName}"` : "no tracking de logística"} as colunas{" "}
          {CATALOG_STAGES.map((stage) => stage.name).join(" → ")}, cada uma com a tag de mesmo nome. O pedido chega em
          &quot;Novo Pedido&quot;, avança sozinho até &quot;Pagamento confirmado&quot; e o cliente recebe os avisos de cada etapa.
          Nada é apagado.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={!isEnabled || !trackingId || applyDefaultStages.isPending}
        onClick={handleApply}
      >
        {applyDefaultStages.isPending ? <OrbitaSpinner className="size-4 " /> : <Wand2 className="size-4" />}
        Aplicar padrão do sistema
      </Button>
    </div>
  );
}
