"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, X } from "lucide-react";
import { useAstroMetaContext } from "@/features/astro/hooks/use-astro-meta-context";

/**
 * Chip mostrando a campanha em foco no chat. Click no X limpa o contexto.
 * Quando scope === "all", mostra "Todas as campanhas".
 */
export function AstroActiveCampaignChip() {
  const { activeCampaign, scope, clear } = useAstroMetaContext();
  if (scope === null) return null;

  const label =
    scope === "all"
      ? "Todas as campanhas"
      : activeCampaign?.name ?? activeCampaign?.metaCampaignId ?? "—";

  return (
    <div className="flex items-center gap-2 rounded-full border bg-muted/40 px-2 py-1 text-xs">
      <Target className="size-3 text-primary" />
      <span className="text-muted-foreground">Trabalhando em:</span>
      <Badge variant="secondary" className="text-[10px] font-medium">
        {label}
      </Badge>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="size-5 rounded-full"
        onClick={clear}
        aria-label="Limpar contexto"
      >
        <X className="size-3" />
      </Button>
    </div>
  );
}
