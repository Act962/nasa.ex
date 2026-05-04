"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";
import { APP_LABELS } from "@/lib/activity-constants";
import { cn } from "@/lib/utils";

interface Props {
  orgIds: string[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function timeSince(date: Date) {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min`;
  const hr = Math.floor(min / 60);
  return `${hr}h`;
}

export function NowPanel({ orgIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getActivityNow.queryOptions({
      input: { orgIds: orgIds.length > 0 ? orgIds : undefined },
    }),
    refetchInterval: 30_000,
  });

  const grouped = useMemo(() => {
    const map: Record<string, typeof data extends { now: infer T } ? T : never> =
      {} as any;
    for (const u of data?.now ?? []) {
      const slug = u.activeAppSlug ?? "system";
      if (!map[slug]) map[slug] = [] as any;
      (map[slug] as any[]).push(u);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="rounded-xl border p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const count = data?.count ?? 0;

  return (
    <div className="rounded-xl border bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
          <Activity className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">O que está fazendo agora</h3>
          <p className="text-[11px] text-muted-foreground">
            {count} {count === 1 ? "usuário ativo" : "usuários ativos"} nos últimos 2 minutos
          </p>
        </div>
        <div
          className={cn(
            "size-2 rounded-full",
            count > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-300",
          )}
        />
      </div>

      {count === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Ninguém está ativo agora.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(grouped).map(([slug, users]: [string, any]) => (
            <div
              key={slug}
              className="rounded-lg border bg-background p-2.5 min-w-0"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {APP_LABELS[slug] ?? slug}
              </p>
              <div className="space-y-1.5">
                {(users as any[]).map((u) => (
                  <div key={u.userId} className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <Avatar className="size-6">
                        <AvatarImage src={u.image ?? ""} alt={u.name} />
                        <AvatarFallback className="text-[9px]">
                          {initials(u.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-px -right-px size-1.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      {u.activePath && (
                        <p className="text-[10px] text-muted-foreground truncate font-mono">
                          {u.activePath}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeSince(u.lastSeenAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
