"use client";

/**
 * LeadPurchaseBasket — ícone de cesta colorido no card do lead.
 *
 * Cor:
 *   cinza    → nunca comprou
 *   verde    → comprou até `basketRecentDays` atrás
 *   amarelo  → entre recent e medium
 *   laranja  → entre medium e long
 *   vermelho → passou de long
 */

import { ShoppingBasket } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Thresholds = {
  recentDays: number;
  mediumDays: number;
  longDays: number;
};

export type PurchaseInfo = {
  lastPurchaseAt: string | null;
  source: "payment" | "contract" | "both" | null;
};

interface Props {
  purchase?: PurchaseInfo;
  thresholds: Thresholds;
  className?: string;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function colorClasses(days: number | null, thresholds: Thresholds) {
  if (days === null) return "text-zinc-400 dark:text-zinc-500";
  if (days <= thresholds.recentDays) return "text-emerald-500";
  if (days <= thresholds.mediumDays) return "text-yellow-500";
  if (days <= thresholds.longDays) return "text-orange-500";
  return "text-red-500";
}

function sourceLabel(source: PurchaseInfo["source"]): string {
  if (source === "payment") return "Payment";
  if (source === "contract") return "Contrato Forge";
  if (source === "both") return "Payment + Contrato";
  return "";
}

export function LeadPurchaseBasket({ purchase, thresholds, className }: Props) {
  const days = purchase?.lastPurchaseAt ? daysSince(purchase.lastPurchaseAt) : null;
  const color = colorClasses(days, thresholds);

  const tooltip = (() => {
    if (!purchase || !purchase.lastPurchaseAt) return "Ainda não comprou";
    const dateLabel = new Date(purchase.lastPurchaseAt).toLocaleDateString(
      "pt-BR",
    );
    const daysLabel =
      days === 0
        ? "hoje"
        : days === 1
          ? "1 dia atrás"
          : `${days} dias atrás`;
    const src = sourceLabel(purchase.source);
    return `Última compra: ${dateLabel} (${daysLabel})${src ? ` · ${src}` : ""}`;
  })();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-md p-0.5",
              className,
            )}
          >
            <ShoppingBasket className={cn("size-3.5", color)} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
