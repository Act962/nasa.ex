import { cn } from "@/lib/utils";
import { TechnicalTerm, type TechnicalTermKey } from "../technical-term";

export interface PanelStat {
  key: string;
  label: string;
  value: string;
  hint?: string;
  term?: TechnicalTermKey;
}

/** Números que importam, sempre à vista — mesmo zerados. 2 colunas no celular. */
export function PanelStatGrid({
  stats,
  className,
}: {
  stats: PanelStat[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4",
        className,
      )}
    >
      {stats.map((stat) => (
        <div
          key={stat.key}
          className="min-w-0 rounded-[18px] border bg-card px-3.5 py-3"
        >
          <p className="flex items-center text-[12px] text-muted-foreground">
            <span className="truncate">{stat.label}</span>
            {stat.term && <TechnicalTerm term={stat.term} />}
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold tabular-nums">
            {stat.value}
          </p>
          {stat.hint && (
            <p className="truncate text-[11px] text-muted-foreground">
              {stat.hint}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
