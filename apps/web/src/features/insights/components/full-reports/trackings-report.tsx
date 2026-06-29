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
import { Target, Download, TrendingUp, Tag, Zap, DollarSign } from "lucide-react";
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

export function TrackingsReport({ from, to, memberIds }: Props) {
  const { data, isLoading } = useQuery({
    ...orpc.insights.getTrackingsReport.queryOptions({
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

  const trackings = data?.trackings ?? [];

  const handleExport = () => {
    const rows = trackings.map((tr) => ({
      Tracking: tr.name,
      Projeto: tr.orgProject?.name ?? "",
      Leads: tr.totals.leads,
      Convertidos: tr.totals.won,
      "% Conversão": formatPercent(tr.totals.conversionRate),
      Ativos: tr.totals.active,
      Perdidos: tr.totals.lost,
      "Faturamento bruto": formatCurrency(tr.totals.grossRevenue, true),
      "Valor ganhos (leads)": formatCurrency(tr.totals.wonAmount),
      "Tempo médio conclusão": formatDuration(tr.avgCompletionMs),
      "Sem tag": tr.totals.missingTag,
      Participantes: tr.totals.participants,
      "Automações ativas": tr.totals.activeAutomations,
    }));
    exportToCSV(rows, `trackings-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="size-4" />
          <strong className="text-foreground">{data?.totalTrackings ?? 0}</strong>
          {(data?.totalTrackings ?? 0) === 1 ? "tracking" : "trackings"}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={trackings.length === 0}
        >
          <Download className="size-3.5 mr-1.5" /> Exportar CSV
        </Button>
      </div>

      {trackings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          Nenhum tracking encontrado para o período/filtros selecionados.
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking</TableHead>
                <TableHead className="text-right">Leads</TableHead>
                <TableHead className="text-right">Convertidos</TableHead>
                <TableHead className="text-right">Ativos</TableHead>
                <TableHead className="text-right">Faturamento</TableHead>
                <TableHead className="text-right">Tempo médio</TableHead>
                <TableHead className="text-right">Sem tag</TableHead>
                <TableHead>Participantes</TableHead>
                <TableHead className="text-right">Automações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trackings.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell>
                    <div className="font-medium">{tr.name}</div>
                    {tr.orgProject && (
                      <div className="text-[10px] text-muted-foreground">
                        {tr.orgProject.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {tr.totals.leads}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium text-emerald-600">
                      {tr.totals.won}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-0.5 justify-end">
                      <TrendingUp className="size-2.5" />
                      {formatPercent(tr.totals.conversionRate)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {tr.totals.active}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <div className="flex items-center gap-1 justify-end">
                      <DollarSign className="size-3 text-muted-foreground" />
                      {formatCurrency(tr.totals.grossRevenue, true).replace("R$", "")}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {formatDuration(tr.avgCompletionMs)}
                  </TableCell>
                  <TableCell className="text-right">
                    {tr.totals.missingTag > 0 ? (
                      <Badge variant="outline" className="gap-1">
                        <Tag className="size-3" />
                        {tr.totals.missingTag}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center -space-x-2">
                      {tr.participants.slice(0, 4).map((p) => (
                        <Avatar key={p.id} className="size-6 border-2 border-background">
                          <AvatarImage src={p.image ?? ""} />
                          <AvatarFallback className="text-[9px]">
                            {initials(p.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {tr.participants.length > 4 && (
                        <div className="size-6 rounded-full bg-muted border-2 border-background text-[10px] flex items-center justify-center">
                          +{tr.participants.length - 4}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={tr.totals.activeAutomations > 0 ? "default" : "secondary"}
                      className="gap-1"
                    >
                      <Zap className="size-3" />
                      {tr.totals.activeAutomations}/{tr.totals.automations}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
