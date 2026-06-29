"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { useOrgRole } from "@/hooks/use-org-role";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";

const OPTIONS = [60, 30] as const;
type Interval = (typeof OPTIONS)[number];

export function HeartbeatIntervalToggle() {
  const { canManage } = useOrgRole();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery(orpc.activity.getConfig.queryOptions());

  const mutation = useMutation({
    ...orpc.activity.setConfig.mutationOptions(),
    onSuccess: (res) => {
      qc.setQueryData(orpc.activity.getConfig.queryKey(), {
        heartbeatIntervalSeconds: res.heartbeatIntervalSeconds,
      });
    },
  });

  if (!canManage) return null;
  if (isLoading) return <Skeleton className="h-7 w-24 rounded-full" />;

  const current = (data?.heartbeatIntervalSeconds as Interval) ?? 60;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 p-0.5 text-xs"
            role="radiogroup"
            aria-label="Intervalo de heartbeat"
          >
            <Zap className="size-3 ml-1.5 text-muted-foreground shrink-0" />
            {OPTIONS.map((value) => {
              const active = current === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={mutation.isPending}
                  onClick={() => {
                    if (active || mutation.isPending) return;
                    mutation.mutate({ heartbeatIntervalSeconds: value });
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-medium transition-colors",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    mutation.isPending && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {value}s
                </button>
              );
            })}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          <p className="text-xs">Frequência do heartbeat. 60s economiza tráfego, 30s dá mais granularidade.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
