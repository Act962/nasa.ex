"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Download, Bell, Clock, TrendingUp } from "lucide-react";
import { formatDuration, formatCurrency, formatPercent, exportToCSV } from "./format-utils";

interface Props {
  from: string;
  to: string;
  memberIds: string[];
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AttendantsReport({ from, to, memberIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getAttendantsReport.queryOptions({
      input: { from, to, memberIds: memberIds.length > 0 ? memberIds : undefined },
    }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const attendants = data?.attendants ?? [];

  const handleExport = () => {
    const rows = attendants.map((a) => ({
      Atendente: a.name,
      Email: a.email,
      Cargo: a.role,
      Leads: a.totals.leads,
      Conversas: a.totals.conversations,
      Atendidas: a.totals.attended,
      "Taxa atendimento": formatPercent(a.totals.attendanceRate),
      "TTFR médio": formatDuration(a.totals.avgTtfrMs),
      Convertidos: a.totals.won,
      "% Conversão": formatPercent(a.totals.conversionRate),
      Ativos: a.totals.active,
      Faturamento: formatCurrency(a.totals.wonAmount),
      "Lembretes ativos": a.totals.activeReminders,
      "Top tags": a.topTags.map((t) => `${t.name} (${t.count})`).join("; "),
    }));
    exportToCSV(rows, `atendentes-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="size-4" />
          <strong className="text-foreground">{data?.totalAttendants ?? 0}</strong>
          atendentes
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={attendants.length === 0}
        >
          <Download className="size-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {attendants.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum atendente encontrado para o período/filtros selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          {attendants.map((a) => (
            <div key={a.id} className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3 mb-4">
                <Avatar className="size-12">
                  <AvatarImage src={a.image ?? ""} />
                  <AvatarFallback>{initials(a.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold truncate">{a.name}</h3>
                    <Badge variant="secondary" className="capitalize text-[10px]">
                      {a.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                </div>
                {a.totals.activeReminders > 0 && (
                  <Badge variant="outline" className="gap-1 shrink-0">
                    <Bell className="size-3" />
                    {a.totals.activeReminders} lembretes
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
                <Metric label="Leads" value={a.totals.leads} />
                <Metric label="Conversas" value={a.totals.conversations} />
                <Metric label="Atendidas" value={a.totals.attended} />
                <Metric
                  label="Taxa atend."
                  value={formatPercent(a.totals.attendanceRate)}
                />
                <Metric
                  label="TTFR médio"
                  value={formatDuration(a.totals.avgTtfrMs)}
                  icon={<Clock className="size-3" />}
                />
                <Metric
                  label="Convertidos"
                  value={`${a.totals.won} (${formatPercent(a.totals.conversionRate)})`}
                  highlight
                  icon={<TrendingUp className="size-3" />}
                />
                <Metric label="Ativos" value={a.totals.active} />
              </div>

              {a.topTags.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5 font-medium">
                    Tags mais usadas
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {a.topTags.map((t) => (
                      <div
                        key={t.id}
                        className="text-[10px] px-2 py-1 rounded-full border flex items-center gap-1"
                        style={{
                          borderColor: t.color ?? "currentColor",
                          color: t.color ?? "currentColor",
                        }}
                      >
                        <span>{t.name}</span>
                        <span className="opacity-60">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  highlight,
  icon,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2.5 py-2">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={`text-sm font-semibold mt-0.5 ${highlight ? "text-emerald-600" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
