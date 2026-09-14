import { formatBrlFromCents } from "@/features/trafego/lib/pricing";
import { cn } from "@/lib/utils";

interface PriceBreakdownProps {
  adBudgetBrlCents: number;
  serviceFeeBrlCents: number;
  totalBrlCents: number;
  className?: string;
  compact?: boolean;
}

/**
 * Decomposição do preço. O cliente precisa ver que metade do valor vira verba
 * de anúncio — é o argumento de venda contra a agência tradicional.
 */
export function PriceBreakdown({
  adBudgetBrlCents,
  serviceFeeBrlCents,
  totalBrlCents,
  className,
  compact = false,
}: PriceBreakdownProps) {
  return (
    <div className={cn("text-sm", className)}>
      <div className="flex items-baseline justify-between gap-3 text-white/60">
        <span>Verba de tráfego</span>
        <span className="tabular-nums">{formatBrlFromCents(adBudgetBrlCents)}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-white/60">
        <span>Taxa de serviço</span>
        <span className="tabular-nums">{formatBrlFromCents(serviceFeeBrlCents)}</span>
      </div>
      <div
        className={cn(
          "mt-2 flex items-baseline justify-between gap-3 border-t border-white/10 pt-2 font-semibold text-white",
          compact ? "text-sm" : "text-base",
        )}
      >
        <span>Total</span>
        <span className="tabular-nums">{formatBrlFromCents(totalBrlCents)}</span>
      </div>
    </div>
  );
}
