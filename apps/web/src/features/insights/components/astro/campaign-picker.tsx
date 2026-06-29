"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, Layers } from "lucide-react";
import { useAstroMetaContext } from "@/features/astro/hooks/use-astro-meta-context";

export type PickerCampaign = {
  metaCampaignId: string;
  name: string;
  status?: string;
  effectiveStatus?: string;
  objective?: string;
  dailyBudgetReais?: number;
};

/**
 * Card de seleção de campanha pro chat. Renderizado quando uma tool
 * retornou `requiresCampaignSelection: true` no payload.
 *
 * Click em um card chama `setActiveCampaign` no zustand + dispara callback
 * pra o chat enviar mensagem confirmadora ao Astro.
 */
export function AstroCampaignPicker({
  campaigns,
  onSelect,
}: {
  campaigns: PickerCampaign[];
  onSelect?: (camp: PickerCampaign | "all") => void;
}) {
  const { setActiveCampaign, setScopeAll } = useAstroMetaContext();

  if (campaigns.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-xs text-muted-foreground">
          Nenhuma campanha disponível.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Target className="size-3.5 text-primary" />
          Selecione uma campanha pra trabalhar
        </div>
        <div className="space-y-1.5">
          {campaigns.map((c) => (
            <button
              key={c.metaCampaignId}
              type="button"
              onClick={() => {
                setActiveCampaign({
                  metaCampaignId: c.metaCampaignId,
                  name: c.name,
                  status: c.status,
                  dailyBudgetReais: c.dailyBudgetReais,
                });
                onSelect?.(c);
              }}
              className="w-full text-left rounded-md border bg-background hover:bg-muted/50 transition-colors p-2.5 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    {c.metaCampaignId}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  {c.dailyBudgetReais != null && (
                    <span className="text-xs font-medium tabular-nums">
                      R$ {c.dailyBudgetReais.toFixed(2)}/dia
                    </span>
                  )}
                  {c.status && (
                    <Badge
                      variant="outline"
                      className={`text-[9px] py-0 px-1 ${
                        c.status === "ACTIVE"
                          ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                          : "border-muted text-muted-foreground"
                      }`}
                    >
                      {c.status}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="border-t pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full text-xs gap-1.5"
            onClick={() => {
              setScopeAll();
              onSelect?.("all");
            }}
          >
            <Layers className="size-3" />
            Trabalhar com TODAS as campanhas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
