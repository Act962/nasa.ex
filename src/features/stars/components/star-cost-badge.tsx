"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { StarIcon } from "./star-icon";

interface StarCostBadgeProps {
  appSlug: string;
  className?: string;
  showSetup?: boolean;
}

export function StarCostBadge({ appSlug, className, showSetup = false }: StarCostBadgeProps) {
  const { data } = useQuery({
    ...orpc.stars.getAppCost.queryOptions({ input: { appSlug } }),
    staleTime: 5 * 60 * 1000,
  });

  if (!data || data.monthlyCost === 0) return null;

  return (
    <div className={cn("flex items-center gap-1.5 flex-wrap", className)}>
      {data.monthlyCost > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-warning/10 border border-warning/30 text-[10px] font-semibold text-warning">
          <StarIcon className="size-2.5" />
          {data.monthlyCost}/mês
        </span>
      )}
      {showSetup && data.setupCost > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-warning/15 text-warning text-[10px] font-semibold">
          <StarIcon className="size-2.5" />
          +{data.setupCost} ativação
        </span>
      )}
      {data.priceBrl && data.priceBrl > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-success/15 text-success text-[10px] font-semibold">
          R$ {data.priceBrl}/mês
        </span>
      )}
    </div>
  );
}
