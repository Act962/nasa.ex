"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Star, Activity, Clock, EyeOff, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  orgIds: string[];
  from?: string;
  to?: string;
  /** Quando vazio, agrega todos os membros da org. */
  memberIds: string[];
}

function formatDuration(ms: number) {
  if (!ms) return "0m";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  const restMin = min - hr * 60;
  return restMin ? `${hr}h ${restMin}m` : `${hr}h`;
}

function formatNum(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function StatsCards({ orgIds, from, to, memberIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getActivitySummary.queryOptions({
      input: {
        orgIds: orgIds.length > 0 ? orgIds : undefined,
        from,
        to,
        userIds: memberIds.length > 0 ? memberIds : undefined,
      },
    }),
    refetchInterval: 60_000,
  });

  const filteredByMember = memberIds.length > 0;

  const cards = [
    {
      label: "Tempo ativo",
      value: isLoading ? null : formatDuration((data?.totalActiveSec ?? 0) * 1000),
      icon: Clock,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/30",
      hint: null as string | null,
    },
    {
      label: "Tempo inativo",
      value: isLoading ? null : formatDuration((data?.totalInactiveSec ?? 0) * 1000),
      icon: EyeOff,
      color: "text-slate-600",
      bg: "bg-slate-50 dark:bg-slate-900/30",
      hint: null,
    },
    {
      label: "Ações no período",
      value: isLoading
        ? null
        : formatNum(data?.byUser.reduce((s, u) => s + u.actions, 0) ?? 0),
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/30",
      hint: null,
    },
    {
      label: "Space Points",
      value: isLoading ? null : formatNum(data?.spacePointsEarned ?? 0),
      icon: Sparkles,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/30",
      hint: null,
    },
    {
      label: "Stars consumidos",
      value: isLoading ? null : formatNum(data?.starsConsumed ?? 0),
      icon: Star,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      // STARs são contabilizadas a nível de organização — sem coluna de
      // userId em StarTransaction. Quando há membros filtrados, deixamos
      // explícito que esse total continua sendo o da org inteira.
      hint: filteredByMember
        ? "Stars são contabilizadas a nível de organização — esse total é da org no período, não filtrado por membro."
        : null,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-xl border bg-background p-3 flex items-start gap-3"
        >
          <div className={cn("size-9 rounded-lg flex items-center justify-center shrink-0", c.bg)}>
            <c.icon className={cn("size-4", c.color)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {c.label}
              </p>
              {c.hint && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex"
                      aria-label="Mais informações"
                    >
                      <Info className="size-3 text-muted-foreground/70 hover:text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[240px]">
                    {c.hint}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {c.value === null ? (
              <Skeleton className="h-6 w-16 mt-1" />
            ) : (
              <p className="text-xl font-bold mt-0.5">{c.value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
