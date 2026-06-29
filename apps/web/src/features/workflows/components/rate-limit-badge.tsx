"use client";

/**
 * Badge no Panel do canvas que mostra runs/hora atual vs cap. Verde
 * quando saudável (<70%), amarelo (70-95%), vermelho (>=95%). Reusa
 * a query `workflow.listRuns` que já traz `runsLastHour` nas métricas.
 */
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Badge } from "@/components/ui/badge";
import { GaugeIcon } from "lucide-react";

export function RateLimitBadge({
  workflowId,
  maxRunsPerHour,
}: {
  workflowId: string;
  maxRunsPerHour: number;
}) {
  const { data } = useQuery({
    ...orpc.workflow.listRuns.queryOptions({
      input: { workflowId, limit: 1 },
    }),
    refetchInterval: 30_000, // atualiza a cada 30s
  });

  const used = data?.metrics?.runsLastHour ?? 0;
  const pct = maxRunsPerHour > 0 ? (used / maxRunsPerHour) * 100 : 0;

  const color =
    pct >= 95
      ? "bg-red-500/15 text-red-700 border-red-300"
      : pct >= 70
        ? "bg-amber-500/15 text-amber-700 border-amber-300"
        : "bg-emerald-500/15 text-emerald-700 border-emerald-300";

  return (
    <Badge
      variant="outline"
      className={`${color} gap-1 bg-background/80 backdrop-blur`}
      title={`Rate limit: ${used} de ${maxRunsPerHour} execuções na última hora`}
    >
      <GaugeIcon className="size-3" />
      {used} / {maxRunsPerHour}
    </Badge>
  );
}
