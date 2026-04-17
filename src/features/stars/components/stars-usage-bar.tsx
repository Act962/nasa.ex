"use client";

import { cn } from "@/lib/utils";

interface StarsUsageBarProps {
  used: number;
  limit: number;
  showPercent?: boolean;
  className?: string;
}

/**
 * Componente unificado para exibir o progresso de consumo de Stars (0 → Limite)
 */
export function StarsUsageBar({
  used,
  limit,
  showPercent = false,
  className,
}: StarsUsageBarProps) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  // Cores baseadas no nível de consumo
  const colorClass =
    pct >= 95
      ? "bg-red-500"
      : pct >= 80
        ? "bg-amber-500"
        : pct >= 60
          ? "bg-yellow-400"
          : "bg-[#7C3AED]";

  return (
    <div className={cn("space-y-1.5 w-full", className)}>
      {showPercent && (
        <div className="flex justify-between text-[11px] text-muted-foreground mb-0.5">
          <span>Consumo do ciclo</span>
          <span
            className={cn(
              "font-semibold",
              pct >= 95 ? "text-red-500" : pct >= 80 ? "text-amber-500" : "text-foreground"
            )}
          >
            {Math.round(pct)}%
          </span>
        </div>
      )}
      
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700 ease-out", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
