import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LinnkerKpi {
  label: string;
  value: number;
  icon: ReactNode;
}

/** Números em 2 colunas no celular e numa linha só no computador. */
export function LinnkerKpiGrid({ kpis, className }: { kpis: LinnkerKpi[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:gap-3", kpis.length >= 4 ? "md:grid-cols-4" : "md:grid-cols-3", className)}>
      {kpis.map((kpi) => (
        <div key={kpi.label} className="flex min-w-0 items-center gap-2.5 rounded-[18px] border border-line bg-card p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
            {kpi.icon}
          </div>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-semibold tabular-nums">{kpi.value.toLocaleString("pt-BR")}</p>
            <p className="truncate text-[12px] text-muted-foreground">{kpi.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
