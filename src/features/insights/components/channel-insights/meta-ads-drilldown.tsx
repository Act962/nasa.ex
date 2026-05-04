"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboardFilters } from "@/features/insights/hooks/use-dashboard-store";
import { Layers } from "lucide-react";

const fmt = (v: number, d = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

type Level = "campaign" | "adset" | "ad";

export function MetaAdsDrilldown() {
  const { dateRange } = useDashboardFilters();
  const [level, setLevel] = useState<Level>("campaign");

  const input = {
    level,
    ...(dateRange.from && dateRange.to
      ? { startDate: dateRange.from.toISOString(), endDate: dateRange.to.toISOString() }
      : { datePreset: "last_30d" as const }),
  };

  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsDrilldown.queryOptions({ input }),
  );

  const rows = data?.rows ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="size-4 text-[#0082FB]" />
          Drill-down por {level === "campaign" ? "campanha" : level === "adset" ? "conjunto" : "anúncio"}
        </CardTitle>
        <div className="flex gap-1">
          {(["campaign", "adset", "ad"] as Level[]).map((l) => (
            <Button
              key={l}
              size="sm"
              variant={level === l ? "default" : "outline"}
              onClick={() => setLevel(l)}
              className="h-7 px-3 text-xs"
            >
              {l === "campaign" ? "Campanhas" : l === "adset" ? "Conjuntos" : "Anúncios"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Sem dados para o período selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Impressões</th>
                  <th className="text-right py-2 px-2 font-medium">Cliques</th>
                  <th className="text-right py-2 px-2 font-medium">CTR</th>
                  <th className="text-right py-2 px-2 font-medium">CPC</th>
                  <th className="text-right py-2 px-2 font-medium">CPM</th>
                  <th className="text-right py-2 px-2 font-medium">Gasto</th>
                  <th className="text-right py-2 px-2 font-medium">Conv.</th>
                  <th className="text-right py-2 px-2 font-medium">CPA</th>
                  <th className="text-right py-2 px-2 font-medium">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const name = r.campaignName ?? r.adsetName ?? r.adName ?? r.campaignId ?? r.adsetId ?? r.adId ?? `#${i}`;
                  const id = r.adId ?? r.adsetId ?? r.campaignId ?? `${i}`;
                  return (
                    <tr key={id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 px-2 max-w-[280px] truncate" title={name}>{name}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.impressions)}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.clicks)}</td>
                      <td className="py-2 px-2 text-right">{fmtPct(r.ctr)}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(r.cpc)}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(r.cpm)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtCurrency(r.spend)}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.conversions)}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(r.cpa)}</td>
                      <td className="py-2 px-2 text-right font-medium">{r.roas.toFixed(2)}x</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
