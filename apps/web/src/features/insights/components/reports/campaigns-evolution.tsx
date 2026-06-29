"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Minus,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CampaignsEvolutionChart,
  type KpiKey,
  CAMPAIGN_COLORS,
} from "./campaigns-evolution-chart";

const KPI_OPTIONS: { value: KpiKey; label: string; tone: "good" | "bad" }[] = [
  { value: "spend", label: "Investido", tone: "good" },
  { value: "leads", label: "Leads", tone: "good" },
  { value: "conversions", label: "Conversões", tone: "good" },
  { value: "roas", label: "ROAS", tone: "good" },
  { value: "ctr", label: "CTR", tone: "good" },
  { value: "cpc", label: "CPC", tone: "bad" },
  { value: "cpm", label: "CPM", tone: "bad" },
  { value: "cpa", label: "Custo por conversão", tone: "bad" },
  { value: "impressions", label: "Impressões", tone: "good" },
  { value: "reach", label: "Alcance", tone: "good" },
  { value: "clicks", label: "Cliques", tone: "good" },
];

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(v);
const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v)}%`;
const fmtDecimal = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);

const KPI_FORMATTERS: Record<KpiKey, (v: number) => string> = {
  spend: fmtCurrency,
  leads: fmtInt,
  conversions: fmtInt,
  roas: fmtDecimal,
  ctr: fmtPct,
  cpc: fmtCurrency,
  cpm: fmtCurrency,
  cpa: fmtCurrency,
  impressions: fmtInt,
  reach: fmtInt,
  clicks: fmtInt,
};

function DeltaCell({
  pct,
  tone,
}: {
  pct: number | null;
  tone: "good" | "bad";
}) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" /> —
      </span>
    );
  }
  const isUp = pct > 0;
  const isDown = pct < 0;
  // tone "good" significa que aumentar é bom; "bad" significa que aumentar é ruim
  const positive = (isUp && tone === "good") || (isDown && tone === "bad");
  const negative = (isUp && tone === "bad") || (isDown && tone === "good");
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        positive && "text-emerald-600 dark:text-emerald-400",
        negative && "text-red-600 dark:text-red-400",
        !positive && !negative && "text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {fmtPct(Math.abs(pct))}
    </span>
  );
}

export function CampaignsEvolution() {
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [kpi, setKpi] = useState<KpiKey>("spend");
  const [visibleCampaignIds, setVisibleCampaignIds] = useState<Set<string>>(
    new Set(),
  );

  const reportsListQuery = useQuery({
    queryKey: ["insights", "listSavedReports"],
    queryFn: () => orpc.insights.listSavedReports.call({}),
    refetchOnWindowFocus: false,
  });

  const allReports = (reportsListQuery.data?.reports ?? []) as Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;

  // Auto-seleciona os 6 últimos relatórios na primeira carga
  useEffect(() => {
    if (selectedReportIds.length === 0 && allReports.length > 0) {
      setSelectedReportIds(allReports.slice(0, 6).map((r) => r.id));
    }
  }, [allReports, selectedReportIds.length]);

  const evolutionQuery = useQuery({
    ...orpc.insights.getCampaignsEvolution.queryOptions({
      input: { reportIds: selectedReportIds },
    }),
    enabled: selectedReportIds.length >= 1,
  });

  const evolution = evolutionQuery.data;

  // Por padrão, mostra todas as campanhas. Quando os dados chegam pela
  // primeira vez, popula o set de visíveis.
  useEffect(() => {
    if (evolution?.campaigns && visibleCampaignIds.size === 0) {
      setVisibleCampaignIds(new Set(evolution.campaigns.map((c) => c.metaCampaignId)));
    }
  }, [evolution?.campaigns, visibleCampaignIds.size]);

  const toggleCampaign = (id: string) => {
    setVisibleCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleReport = (id: string) => {
    setSelectedReportIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  // Reports ordenados ASC (eixo X cronológico)
  const reports = useMemo(
    () =>
      (evolution?.reports ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        savedAt: r.savedAt,
      })),
    [evolution?.reports],
  );

  const campaigns = useMemo(
    () => evolution?.campaigns ?? [],
    [evolution?.campaigns],
  );

  const kpiCfg = KPI_OPTIONS.find((k) => k.value === kpi)!;
  const fmt = KPI_FORMATTERS[kpi];

  const reportsMissing = evolution?.reportsMissingCampaigns ?? [];
  const allLoading = reportsListQuery.isLoading || evolutionQuery.isLoading;

  if (reportsListQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (allReports.length < 2) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <TrendingUp className="size-6 mx-auto text-muted-foreground/50" />
          <p className="text-sm font-medium">
            Você precisa de pelo menos 2 relatórios salvos pra ver a evolução.
          </p>
          <p className="text-xs text-muted-foreground">
            Salve relatórios periodicamente em <strong>Visão Geral</strong> →{" "}
            <strong>Salvar relatório</strong> e volte aqui pra acompanhar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controles */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            KPI:
          </span>
          <Select value={kpi} onValueChange={(v) => setKpi(v as KpiKey)}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KPI_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-2">
              {selectedReportIds.length} relatório
              {selectedReportIds.length === 1 ? "" : "s"} selecionado
              {selectedReportIds.length === 1 ? "" : "s"}
              <ChevronDown className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
              Relatórios para comparar
            </p>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {allReports.map((r) => {
                const checked = selectedReportIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleReport(r.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{r.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {reportsMissing.length > 0 && (
          <Badge variant="outline" className="text-[10px] gap-1">
            ⚠ {reportsMissing.length} relatório
            {reportsMissing.length === 1 ? "" : "s"} sem campanhas (salvos
            antes da feature)
          </Badge>
        )}
      </div>

      {/* Gráfico */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">
              Evolução de {kpiCfg.label} por campanha
            </h3>
            <p className="text-xs text-muted-foreground">
              {reports.length} pontos · {campaigns.length} campanha
              {campaigns.length === 1 ? "" : "s"}
            </p>
          </div>
          {evolutionQuery.isLoading ? (
            <Skeleton className="h-[420px] w-full" />
          ) : (
            <CampaignsEvolutionChart
              reports={reports}
              campaigns={campaigns}
              kpi={kpi}
              visibleCampaignIds={visibleCampaignIds}
            />
          )}
        </CardContent>
      </Card>

      {/* Tabela com deltas */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">
              Variação primeiro → último relatório
            </h3>
            <p className="text-xs text-muted-foreground">
              Clique pra mostrar/esconder linha no gráfico
            </p>
          </div>
          {allLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma campanha encontrada nos relatórios selecionados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium"></th>
                    <th className="py-2 pr-3 font-medium">Campanha</th>
                    <th className="py-2 pr-3 font-medium text-right">Pontos</th>
                    <th className="py-2 pr-3 font-medium text-right">
                      Primeiro
                    </th>
                    <th className="py-2 pr-3 font-medium text-right">Último</th>
                    <th className="py-2 pr-3 font-medium text-right">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => {
                    const d = c.delta?.[kpi];
                    const visible = visibleCampaignIds.has(c.metaCampaignId);
                    return (
                      <tr
                        key={c.metaCampaignId}
                        className={cn(
                          "border-b last:border-0 cursor-pointer hover:bg-muted/40",
                          !visible && "opacity-40",
                        )}
                        onClick={() => toggleCampaign(c.metaCampaignId)}
                      >
                        <td className="py-2 pr-3">
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{
                              backgroundColor: visible
                                ? CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]
                                : "transparent",
                              border: `2px solid ${CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length]}`,
                            }}
                          />
                        </td>
                        <td className="py-2 pr-3 max-w-xs truncate" title={c.name}>
                          {c.name}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">
                          {c.pointCount}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {d ? fmt(d.first) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">
                          {d ? fmt(d.last) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <DeltaCell
                            pct={d?.pctChange ?? null}
                            tone={kpiCfg.tone}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
