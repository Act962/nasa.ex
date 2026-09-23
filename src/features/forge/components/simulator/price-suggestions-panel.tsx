"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useForgePriceSuggestions,
  useReviewForgePriceSuggestion,
} from "@/features/forge/hooks/use-forge-price-catalog";

export function PriceSuggestionsPanel() {
  const { data } = useForgePriceSuggestions("PENDING");
  const reviewMutation = useReviewForgePriceSuggestion();
  const suggestions = data?.suggestions ?? [];

  function review(id: string, action: "APPROVE" | "REJECT") {
    reviewMutation.mutate(
      { id, action },
      {
        onSuccess: () => toast.success(action === "APPROVE" ? "Preço aprovado" : "Sugestão rejeitada"),
        onError: () => toast.error("Não foi possível revisar a sugestão"),
      },
    );
  }

  if (suggestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma sugestão de atualização de preço pendente. O sincronismo semanal cria sugestões aqui
        para você aprovar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => (
        <div key={suggestion.id} className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{suggestion.name}</p>
              <p className="text-xs text-muted-foreground">
                {suggestion.category} · {suggestion.sourceLabel ?? suggestion.sourceUrl ?? "fonte externa"}
              </p>
              <div className="mt-2 flex gap-2 text-xs">
                <Badge variant="secondary">
                  Atual: {JSON.stringify(suggestion.currentValue ?? "—")}
                </Badge>
                <Badge variant="secondary" className="bg-[#7C3AED]/10 text-[#7C3AED]">
                  Sugerido: {JSON.stringify(suggestion.suggestedValue)}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => review(suggestion.id, "REJECT")}
                disabled={reviewMutation.isPending}
              >
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => review(suggestion.id, "APPROVE")}
                disabled={reviewMutation.isPending}
                className="bg-[#7C3AED] hover:bg-[#6D28D9]"
              >
                Aprovar
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
