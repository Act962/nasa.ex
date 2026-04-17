"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { StarIcon } from "./star-icon";
import { StarsPurchaseModal } from "./stars-purchase-modal";
import { SubscriptionPlansModal } from "./subscription-plans-modal";
import { Plus, TrendingUp, AlertTriangle, Zap, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { StarsUsageBar } from "./stars-usage-bar";

// ─── Plan badge ───────────────────────────────────────────────────────────────

function PlanBadge({
  planSlug,
  planName,
}: {
  planSlug: string;
  planName: string;
}) {
  const colors: Record<string, string> = {
    earth: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    explore: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    constellation: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide",
        colors[planSlug] ?? "bg-muted text-muted-foreground",
      )}
    >
      {planName}
    </span>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

export function StarsWidget() {
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);

  const { data, isLoading } = useQuery({
    ...orpc.stars.getBalance.queryOptions(),
    refetchInterval: 15_000,
    staleTime: 0,
  });

  const { data: activeSubscriptions } = useQuery({
    queryKey: ["activeSubscriptionsWidget"],
    queryFn: async () => {
      const { data } = await authClient.subscription.list();
      return data;
    },
    refetchInterval: 60_000,
  });

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="h-8 w-32 rounded-lg bg-muted/60 animate-pulse" />;
  }

  const {
    used = 0,
    totalLimit = 100,
    extraBalance = 0,
    planSlug: dbPlanSlug = "free",
    planName: dbPlanName = "Gratuito",
  } = data || {};

  // Use Better Auth plan as priority, fallback to DB
  const activeSub = activeSubscriptions?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  
  const planName = activeSub ? activeSub.plan.toUpperCase() : dbPlanName;
  const planSlug = activeSub ? activeSub.plan.toLowerCase() : dbPlanSlug;
  const hasPlan = planSlug !== "free" || activeSub !== undefined;

  const remaining = Math.max(0, totalLimit - used);
  const pctUsed = totalLimit > 0 ? (used / totalLimit) * 100 : 0;
  const isLow = pctUsed >= 80;
  const isCritical = pctUsed >= 95;

  return (
    <>
      <div className="flex items-center gap-2">
        {/* ── Stars counter pill ── */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-all focus-visible:outline-none",
                isCritical
                  ? "border-red-400/50 bg-red-500/10 text-red-500 hover:bg-red-500/15"
                  : isLow
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/15"
                    : "border-border/60 bg-background hover:bg-muted/60 text-foreground",
              )}
            >
              {isCritical || isLow ? (
                <AlertTriangle className="size-3.5 shrink-0" />
              ) : (
                <StarIcon className="size-3.5 shrink-0" />
              )}
              <span className="tabular-nums">
                {used.toLocaleString("pt-BR")}
              </span>
              <span className="text-muted-foreground font-normal">/</span>
              <span className="tabular-nums text-muted-foreground font-normal">
                {totalLimit.toLocaleString("pt-BR")}
              </span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-72 p-0 overflow-hidden shadow-xl border-border/60"
          >
            {/* Header */}
            <div className="px-4 py-4 border-b bg-linear-to-br from-[#7C3AED]/8 to-transparent">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Consumo de Stars
                </p>
                <PlanBadge planSlug={planSlug} planName={planName} />
              </div>

              <div className="flex items-baseline gap-1">
                <StarIcon className="size-5 mb-0.5" />
                <span className="text-3xl font-extrabold tabular-nums leading-none">
                  {used.toLocaleString("pt-BR")}
                </span>
                <span className="text-base text-muted-foreground font-normal">
                  / {totalLimit.toLocaleString("pt-BR")}
                </span>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <p className="text-[11px] text-muted-foreground">
                  Restante: <strong>{remaining.toLocaleString("pt-BR")} ★</strong>
                </p>
                {extraBalance > 0 && (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    +{extraBalance.toLocaleString("pt-BR")} extras
                  </p>
                )}
              </div>
            </div>

            {/* Bar + stats */}
            <div className="px-4 py-3 space-y-4">
              <StarsUsageBar used={used} limit={totalLimit} showPercent />

              {isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200/60 p-2.5 dark:bg-red-950/20 dark:border-red-900/40">
                  <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                    Limite atingido ou muito próximo! Compre extras para continuar usando sem interrupções.
                  </p>
                </div>
              )}

              {isLow && !isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 p-2.5 dark:bg-amber-950/20 dark:border-amber-900/40">
                  <Zap className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Você consumiu mais de 80% da sua cota mensal.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-muted/40 px-2 py-1.5 border border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Vence em</p>
                  <p className="text-xs font-semibold mt-0.5">
                    {data?.nextCycleDate ? new Date(data.nextCycleDate).toLocaleDateString("pt-BR") : "--/--/--"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 px-2 py-1.5 border border-border/40">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Status</p>
                  <p className="text-xs font-semibold mt-0.5 flex items-center justify-center gap-1">
                    <TrendingUp className="size-3 text-[#7C3AED]" /> Ativo
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-4 pb-4 border-t pt-4 space-y-2">
              <Button
                size="sm"
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                onClick={() => setPurchaseOpen(true)}
              >
                <Plus className="size-3.5" /> Comprar Extras
              </Button>
              <button
                onClick={() => setPlanOpen(true)}
                className="w-full text-center text-[11px] text-[#7C3AED] hover:underline font-medium"
              >
                {hasPlan ? "Mudar de plano" : "Ver planos disponíveis"}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Adquirir plano ── */}
        {!hasPlan && (
          <button
            onClick={() => setPlanOpen(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-[#7C3AED]/50 bg-[#7C3AED]/5 text-[#7C3AED] text-xs font-semibold hover:bg-[#7C3AED]/10 transition-all"
          >
            <Sparkles className="size-3.5 shrink-0" />
            <span className="hidden sm:block">Fazer Upgrade</span>
          </button>
        )}
      </div>

      <StarsPurchaseModal
        open={purchaseOpen}
        onClose={() => setPurchaseOpen(false)}
      />
      <SubscriptionPlansModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        currentPlanSlug={planSlug}
      />
    </>
  );
}
