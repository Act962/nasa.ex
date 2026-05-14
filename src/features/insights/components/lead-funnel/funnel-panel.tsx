"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TrendingDown, ArrowDown } from "lucide-react";
import { LeadsByMetricDialog } from "@/features/insights/components/leads-by-metric-dialog";

interface FunnelPanelProps {
  trackingId?: string;
  organizationIds?: string[];
}

export function FunnelPanel({ trackingId, organizationIds }: FunnelPanelProps) {
  const [stage, setStage] = useState<{ statusId: string; name: string } | null>(
    null,
  );
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
          {data.stages.map((s, idx) => {
            const widthPct = (s.count / maxCount) * 100;
            return (
              <div key={s.statusId}>
                {idx > 0 && s.dropoffFromPrevious > 0 && (
                  <div className="flex items-center gap-1 text-xs text-rose-600 px-2 py-1">
                    <ArrowDown className="size-3" />
                    {s.dropoffFromPrevious} leads ({s.dropoffPercent}%) de queda
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setStage({ statusId: s.statusId, name: s.name })}
                  className="flex items-center gap-3 w-full text-left hover:bg-accent/30 rounded-md p-1 transition-colors"
                >
                  <div className="w-32 text-sm font-medium truncate">
                    {s.name}
                  </div>
                  <div className="flex-1 relative h-9 rounded-md bg-muted overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 transition-all"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: s.color ?? "hsl(220 80% 60%)",
                        opacity: 0.85,
                      }}
                    />
                    <div className="relative z-10 flex items-center h-full px-3 text-sm text-white font-medium drop-shadow">
                      {s.count}
                    </div>
                  </div>
                  <div className="w-32 text-right text-xs text-muted-foreground">
                    {s.avgTimeHours > 24
                      ? `${Math.round(s.avgTimeHours / 24)}d médios`
                      : `${s.avgTimeHours}h médios`}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
      {stage && (
        <LeadsByMetricDialog
          open={!!stage}
          onOpenChange={(o) => !o && setStage(null)}
          app="lead"
          metric="lead.byStatus"
          title={`Leads em "${stage.name}"`}
          extra={{ statusId: stage.statusId }}
        />
      )}
    </Card>
  );
}
