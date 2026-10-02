"use client";

import { useEffect, useState } from "react";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAstroModelPricing, useSetAstroModelPricing } from "@/features/astro/hooks/use-astro-usage-summary";

/** Margem sobre o custo e modelos liberados na chave da plataforma (spec 0055, RF-12). */
export function ModelPricingSettingsCard({ className }: { className?: string }) {
  const { data: pricing, isLoading } = useAstroModelPricing();
  const savePricing = useSetAstroModelPricing();
  const [markupText, setMarkupText] = useState("");
  const [enabledModelIds, setEnabledModelIds] = useState<string[]>([]);

  useEffect(() => {
    if (!pricing) return;
    // Sincroniza o formulário quando a configuração salva chega do servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMarkupText(String(pricing.markupPercent));
    setEnabledModelIds(pricing.platformModelIds);
  }, [pricing]);

  if (isLoading || !pricing) {
    return (
      <div className={cn("grid place-items-center rounded-[24px] border bg-card p-6", className)}>
        <OrbitaSpinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  const toggleModel = (modelId: string) =>
    setEnabledModelIds((current) =>
      current.includes(modelId) ? current.filter((enabledId) => enabledId !== modelId) : [...current, modelId],
    );

  const handleSave = () => {
    const markupPercent = Number(markupText);
    if (!Number.isInteger(markupPercent) || markupPercent < 0) {
      toast.error("Informe a margem em número inteiro, por exemplo 50.");
      return;
    }
    if (enabledModelIds.length === 0) {
      toast.error("Deixe pelo menos um modelo liberado.");
      return;
    }
    savePricing.mutate(
      { markupPercent, platformModelIds: enabledModelIds },
      {
        onSuccess: () => toast.success("Preço dos modelos salvo."),
        onError: () => toast.error("Não consegui salvar. A migração do banco foi aplicada?"),
      },
    );
  };

  return (
    <section className={cn("space-y-4 rounded-[24px] border bg-card p-5", className)}>
      <div>
        <h2 className="text-sm font-semibold">Preço dos modelos escolhidos</h2>
        <p className="text-xs text-muted-foreground">
          Quando o usuário escolhe um modelo na chave da plataforma, a resposta é cobrada pelo custo real do modelo mais esta margem, convertida em Stars.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="astro-model-markup">Margem sobre o custo (%)</Label>
        <Input
          id="astro-model-markup"
          inputMode="numeric"
          value={markupText}
          disabled={!pricing.canManage}
          onChange={(event) => setMarkupText(event.target.value.replace(/\D/g, ""))}
          className="max-w-32"
        />
      </div>

      <div className="space-y-2">
        <Label>Modelos liberados na chave da plataforma</Label>
        <div className="flex flex-wrap gap-1.5">
          {pricing.catalogModelIds.map((modelId) => {
            const isEnabled = enabledModelIds.includes(modelId);
            return (
              <button
                key={modelId}
                type="button"
                disabled={!pricing.canManage}
                onClick={() => toggleModel(modelId)}
                aria-pressed={isEnabled}
                className={cn(
                  "h-7 rounded-full px-3 font-mono text-[11.5px] transition-colors disabled:opacity-60",
                  isEnabled ? "bg-foreground text-background" : "bg-knob text-muted-foreground hover:text-foreground",
                )}
              >
                {modelId}
              </button>
            );
          })}
        </div>
      </div>

      {pricing.canManage ? (
        <Button onClick={handleSave} disabled={savePricing.isPending}>
          {savePricing.isPending && <OrbitaSpinner className="size-4 " />}
          Salvar
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Só o admin do sistema altera esta configuração.</p>
      )}
    </section>
  );
}
