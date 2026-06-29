"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Circle, Rocket, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SetupProgressWidgetProps {
  variant?: "full" | "compact";
}

export function SetupProgressWidget({ variant = "full" }: SetupProgressWidgetProps) {
  const queryClient = useQueryClient();
  const [celebrating, setCelebrating] = useState(false);

  const { data, isLoading } = useQuery({
    ...orpc.spaceHelp.getSetupProgress.queryOptions(),
    refetchOnWindowFocus: true,
  });

  const claimMutation = useMutation({
    ...orpc.spaceHelp.claimSetupReward.mutationOptions(),
    onSuccess: (result) => {
      if (result.alreadyClaimed) {
        toast.info("Recompensa já foi resgatada anteriormente.");
        return;
      }
      setCelebrating(true);
      toast.success(
        `🎉 Setup completo! +${result.starsAwarded} STARs +${result.spAwarded} SP`,
        { duration: 6000 }
      );
      queryClient.invalidateQueries({ queryKey: orpc.spaceHelp.getSetupProgress.queryKey() });
      queryClient.invalidateQueries({ queryKey: orpc.spaceHelp.listUserBadges.queryKey() });
    },
    onError: (err: any) => {
      toast.error(err?.message ?? "Não foi possível resgatar a recompensa.");
    },
  });

  if (isLoading) {
    return <Skeleton className={variant === "compact" ? "h-32 rounded-2xl" : "h-64 rounded-3xl"} />;
  }
  if (!data) return null;

  const { steps, percent, completedCount, totalCount, isFullyCompleted, rewardClaimed, rewardStars, rewardSpacePoints } = data;

  // Quando já resgatou, mostra um banner pequeno celebratório (apenas no variant full).
  if (rewardClaimed) {
    if (variant === "compact") return null;
    return (
      <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-400/5 to-transparent p-5 md:p-6 flex items-center gap-4">
        <div className="size-12 shrink-0 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <Trophy className="size-6 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base md:text-lg font-bold">Setup Inicial completo</h3>
          <p className="text-sm text-muted-foreground">
            Você já configurou os 5 passos críticos e resgatou suas STARs. 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-3xl border p-5 md:p-7",
        isFullyCompleted
          ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-amber-400/8 to-transparent shadow-md shadow-amber-500/10"
          : "border-violet-500/30 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-emerald-500/5",
        celebrating && "animate-pulse"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Rocket className="size-4" />
            Setup Inicial NASA
          </div>
          <h2 className="mt-1 text-xl md:text-2xl font-bold tracking-tight">
            {isFullyCompleted
              ? "🎉 Tudo pronto! Resgate suas STARs"
              : "Configure sua plataforma em 5 passos"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            {isFullyCompleted
              ? `Você concluiu todos os ${totalCount} passos críticos. Clique em "Resgatar" pra ganhar STARs + SP + selo "Organização Pronta".`
              : `Complete os passos abaixo pra liberar ${rewardStars} STARs + ${rewardSpacePoints} SP + selo exclusivo.`}
          </p>
        </div>
        {!isFullyCompleted && (
          <div className="hidden md:flex flex-col items-end shrink-0">
            <div className="text-3xl font-extrabold tracking-tight tabular-nums">
              {percent}%
            </div>
            <div className="text-xs text-muted-foreground">
              {completedCount}/{totalCount}
            </div>
          </div>
        )}
      </div>

      {/* Barra de progresso */}
      <div className="mt-5 h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isFullyCompleted
              ? "bg-gradient-to-r from-amber-400 to-amber-500"
              : "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-emerald-500"
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Lista de passos */}
      <ul className="mt-5 space-y-2">
        {steps.map((step, idx) => (
          <li
            key={step.key}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3 transition",
              step.isCompleted
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-border bg-background/50 hover:border-violet-500/40"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {step.isCompleted ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <Circle className="size-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground">{idx + 1}.</span>
                <h3
                  className={cn(
                    "font-semibold leading-tight",
                    step.isCompleted && "text-muted-foreground line-through decoration-emerald-500/50"
                  )}
                >
                  {step.label}
                </h3>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/space-help/${step.helpCategorySlug}/${step.helpFeatureSlug}`}
                className="text-xs text-violet-700 dark:text-violet-300 hover:underline whitespace-nowrap"
              >
                Como fazer
              </Link>
              {!step.isCompleted && (
                <Link
                  href={step.ctaHref}
                  className="rounded-md bg-violet-600 hover:bg-violet-700 px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap"
                >
                  {step.ctaLabel}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Botão de resgate quando 100% */}
      {isFullyCompleted && (
        <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-amber-500/15 to-amber-400/10 border border-amber-500/30 p-4">
          <div className="flex items-center gap-3">
            <Sparkles className="size-6 text-amber-600 shrink-0" />
            <div>
              <div className="font-semibold">Recompensa pronta pra resgatar</div>
              <div className="text-xs text-muted-foreground">
                +{rewardStars} STARs · +{rewardSpacePoints} SP · selo Organização Pronta
              </div>
            </div>
          </div>
          <Button
            onClick={() => claimMutation.mutate({})}
            disabled={claimMutation.isPending}
            size="lg"
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            {claimMutation.isPending ? "Resgatando…" : "🎁 Resgatar STARs"}
          </Button>
        </div>
      )}
    </div>
  );
}
