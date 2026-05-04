"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// ─── Consumed bar ─────────────────────────────────────────────────────────────

function ConsumedBar({ consumed, total }: { consumed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (consumed / total) * 100) : 0;
  const color =
    pct >= 95
      ? "bg-red-500"
      : pct >= 80
        ? "bg-amber-500"
        : pct >= 60
          ? "bg-yellow-400"
          : "bg-[#7C3AED]";

  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-500", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

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

  const balance = data?.balance ?? 0;
  const bonusBalance = data?.bonusBalance ?? 0;

  // Use Better Auth plan as priority, fallback to DB
  const activeSub = activeSubscriptions?.find(
    (s) => s.status === "active" || s.status === "trialing",
  );
  const planName = activeSub
    ? activeSub.plan.toUpperCase()
    : (data?.planName ?? "");
  const planSlug = activeSub
    ? activeSub.plan.toLowerCase()
    : (data?.planSlug ?? "free");

  // Prioritize monthlyStars from Better Auth limits, or fallback to ORPC data
  const planMonthlyStars = activeSub?.limits?.monthlyStars
    ? Number(activeSub.limits.monthlyStars)
    : (data?.planMonthlyStars ?? 0);

  // hasPlan is true if we have a valid slug from Stripe or DB
  const hasPlan = planSlug !== "free" && (planMonthlyStars > 0 || !!activeSub);

  const consumed = hasPlan ? balance : 0;
  const remaining = hasPlan ? Math.max(0, planMonthlyStars - consumed) : 0;
  const pctUsed =
    hasPlan && planMonthlyStars > 0 ? (consumed / planMonthlyStars) * 100 : 0;
  const isLow = hasPlan && pctUsed >= 80;
  const isCritical = hasPlan && pctUsed >= 95;

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
              {hasPlan ? (
                <>
                  <span className="tabular-nums">
                    {consumed.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-muted-foreground font-normal hidden sm:inline">/</span>
                  <span className="tabular-nums text-muted-foreground font-normal hidden sm:inline">
                    {planMonthlyStars.toLocaleString("pt-BR")}
                  </span>
                </>
              ) : (
                <span className="tabular-nums">
                  {balance.toLocaleString("pt-BR")}
                </span>
              )}
            </button>
          </PopoverTrigger>

          <PopoverContent
            align="end"
            className="w-72 p-0 overflow-hidden shadow-xl border-border/60"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b bg-linear-to-br from-[#7C3AED]/8 to-transparent">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Stars consumidas
                </p>
                {hasPlan && (
                  <PlanBadge planSlug={planSlug} planName={planName} />
                )}
              </div>

              {hasPlan ? (
                <>
                  <div className="flex items-baseline gap-1">
                    <StarIcon className="size-5 mb-0.5" />
                    <span className="text-3xl font-extrabold tabular-nums leading-none">
                      {consumed.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-base text-muted-foreground font-normal">
                      / {planMonthlyStars.toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Saldo restante:{" "}
                    <strong>{remaining.toLocaleString("pt-BR")} ★</strong>
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <StarIcon className="size-4" />
                  <span>Sem plano ativo</span>
                </div>
              )}

              {bonusBalance > 0 && (
                <p className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Sparkles className="size-3 text-[#7C3AED]" />
                  <span>
                    + <strong>{bonusBalance.toLocaleString("pt-BR")} ★</strong>{" "}
                    de bônus
                    <span className="opacity-70"> · não vale em cursos</span>
                  </span>
                </p>
              )}
            </div>

            {/* Bar + stats */}
            <div className="px-4 py-3 space-y-3">
              {hasPlan && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Consumo do ciclo</span>
                    <span
                      className={cn(
                        "font-semibold",
                        isCritical
                          ? "text-red-500"
                          : isLow
                            ? "text-amber-500"
                            : "text-foreground",
                      )}
                    >
                      {Math.round(pctUsed)}%
                    </span>
                  </div>
                  <ConsumedBar consumed={consumed} total={planMonthlyStars} />
                </div>
              )}

              {isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200/60 p-2.5 dark:bg-red-950/20 dark:border-red-900/40">
                  <AlertTriangle className="size-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 dark:text-red-300 leading-relaxed">
                    Saldo crítico! Integrações podem ser pausadas em breve.
                  </p>
                </div>
              )}

              {isLow && !isCritical && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200/60 p-2.5 dark:bg-amber-950/20 dark:border-amber-900/40">
                  <Zap className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                    Mais de 80% das stars consumidas. Considere recarregar.
                  </p>
                </div>
              )}

              {hasPlan && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      Restante
                    </p>
                    <p className="text-sm font-semibold flex items-center justify-center gap-0.5">
                      <StarIcon className="size-3" />
                      {remaining.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Plano</p>
                    <p className="text-sm font-semibold flex items-center justify-center gap-1">
                      <TrendingUp className="size-3 text-[#7C3AED]" />
                      {planName}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-4 pb-3 border-t pt-3 space-y-2">
              <Button
                size="sm"
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                onClick={() => setPurchaseOpen(true)}
              >
                <Plus className="size-3.5" /> Comprar Stars
              </Button>
              <button
                onClick={() => setPlanOpen(true)}
                className="w-full text-center text-[11px] text-[#7C3AED] hover:underline"
              >
                {hasPlan ? "Mudar de plano" : "Ver planos disponíveis"}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* ── Plan badge / Adquirir plano ── */}
        {hasPlan ? (
          <button
            onClick={() => setPlanOpen(true)}
            title={planName}
            className={cn(
              "flex items-center gap-1 h-8 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-wide transition-all hover:opacity-80",
              planSlug === "earth"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : planSlug === "explore"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400",
            )}
          >
            <TrendingUp className="size-3 sm:hidden" />
            <span className="hidden sm:block">{planName}</span>
          </button>
        ) : (
          <button
            onClick={() => setPlanOpen(true)}
            title="Adquirir um plano"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-dashed border-[#7C3AED]/50 bg-[#7C3AED]/5 text-[#7C3AED] text-xs font-semibold hover:bg-[#7C3AED]/10 transition-all"
          >
            <Sparkles className="size-3.5 shrink-0" />
            <span className="sm:hidden">Plano</span>
            <span className="hidden sm:block">Adquirir um plano</span>
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
