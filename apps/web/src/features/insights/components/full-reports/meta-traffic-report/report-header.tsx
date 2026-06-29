"use client";

import { DateRangeTimePicker } from "@/features/insights/components/activities/date-range-time-picker";
import { BarChart3 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function ReportHeader({
  from,
  to,
  prevFrom,
  prevTo,
  onChangeRange,
}: {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  onChangeRange: (range: { from?: Date; to?: Date }) => void;
}) {
  const { data: activeOrg } = authClient.useActiveOrganization();
  const orgName = activeOrg?.name ?? "—";

  const fmtRange = (a: Date, b: Date) =>
    `${a.toLocaleDateString("pt-BR")} – ${b.toLocaleDateString("pt-BR")}`;

  return (
    <div className="border rounded-xl p-5 bg-card space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Relatório de {orgName}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise de desempenho — Tráfego Meta
            </p>
          </div>
        </div>
        <DateRangeTimePicker from={from} to={to} onChange={onChangeRange} />
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
        <span className="font-medium text-foreground">Período atual:</span>
        <span>{fmtRange(from, to)}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="font-medium text-foreground">Comparado a:</span>
        <span>{fmtRange(prevFrom, prevTo)}</span>
      </div>
    </div>
  );
}
