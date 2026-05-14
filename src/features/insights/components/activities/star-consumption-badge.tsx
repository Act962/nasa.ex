"use client";

import { Star } from "lucide-react";

/**
 * Badge de "consumo" exibido na coluna "Consumo" da Tabela Detalhada
 * de Atividades. Resolve o custo da ação consultando o catálogo
 * global (`AppStarCost` via `orpc.stars.listActionCosts`).
 *
 * Se a ação não tem regra cadastrada, ou tem custo zero, mostra "—".
 */
interface StarConsumptionBadgeProps {
  action: string;
  costs: Record<string, number>;
}

export function StarConsumptionBadge({ action, costs }: StarConsumptionBadgeProps) {
  const stars = costs[action] ?? 0;
  if (stars <= 0) {
    return <span className="text-muted-foreground text-[10px]">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-600 dark:text-yellow-400">
      <Star className="size-3" />
      {stars}
    </span>
  );
}
