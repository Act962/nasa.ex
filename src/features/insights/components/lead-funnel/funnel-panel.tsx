"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TrendingDown, ArrowDown } from "lucide-react";

interface FunnelPanelProps {
  trackingId?: string;
  organizationIds?: string[];
}

export function FunnelPanel({ trackingId, organizationIds }: FunnelPanelProps) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getFunnel.queryOptions({
      input: {
        trackingId: trackingId ?? "",
        organizationIds,
      },
    }),
    enabled: !!trackingId,
  });

  if (!trackingId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Selecione um tracking para visualizar o funil.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!data || data.stages.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhuma etapa configurada nesse tracking.
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.stages.map((s) => s.count), 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingDown className="size-5" />
          Funil — {data.tracking.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {data.total} leads ativos no tracking. Clique numa etapa para ver os leads.
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.stages.map((stage, idx) => {
            const widthPct = (stage.count / maxCount) * 100;
            return (
              <div key={stage.statusId}>
                {idx > 0 && stage.dropoffFromPrevious > 0 && (
                  <div className="flex items-center gap-1 text-xs text-rose-600 px-2 py-1">
                    <ArrowDown className="size-3" />
                    {stage.dropoffFromPrevious} leads ({stage.dropoffPercent}%) de queda
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-32 text-sm font-medium truncate">
                    {stage.name}
                  </div>
                  <div className="flex-1 relative h-9 rounded-md bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 transition-all"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.color ?? "hsl(220 80% 60%)",
                        opacity: 0.85,
                      }}
                    />
                    <div className="relative z-10 flex items-center h-full px-3 text-sm text-white font-medium drop-shadow">
                      {stage.count}
                    </div>
                  </div>
                  <div className="w-32 text-right text-xs text-muted-foreground">
                    {stage.avgTimeHours > 24
                      ? `${Math.round(stage.avgTimeHours / 24)}d médios`
                      : `${stage.avgTimeHours}h médios`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
