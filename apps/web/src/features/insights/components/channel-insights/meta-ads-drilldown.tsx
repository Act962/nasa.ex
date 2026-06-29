"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDashboardFilters } from "@/features/insights/hooks/use-dashboard-store";
import { Image as ImageIcon, Layers, Tag } from "lucide-react";
import { MetaConversionTagPicker } from "./meta-conversion-tag-picker";

const fmt = (v: number, d = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

type Level = "campaign" | "adset" | "ad";

// Thumbnail do anúncio — só aparece no level=ad.
function AdThumb({ url, alt }: { url: string | null | undefined; alt: string }) {
  if (!url) {
    return (
      <div className="flex size-9 items-center justify-center rounded-md bg-muted shrink-0">
        <ImageIcon className="size-3.5 text-muted-foreground/40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="size-9 shrink-0 rounded-md border bg-muted object-cover"
    />
  );
}

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

  const rows = (data?.rows ?? []) as Array<{
    campaignId?: string;
    campaignName?: string;
    adsetId?: string;
    adsetName?: string;
    adId?: string;
    adName?: string;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    spend: number;
    conversions: number;
    cpa: number;
    roas: number;
    thumbnailUrl?: string | null;
  }>;
  const conversionMode = data?.conversionMode ?? "meta";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="size-4 text-[#0082FB]" />
          Drill-down por {level === "campaign" ? "campanha" : level === "adset" ? "conjunto" : "anúncio"}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <MetaConversionTagPicker />
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
                  {level === "ad" && (
                    <th className="text-left py-2 px-2 font-medium w-12">Criativo</th>
                  )}
                  <th className="text-left py-2 px-2 font-medium">Nome</th>
                  <th className="text-right py-2 px-2 font-medium">Impressões</th>
                  <th className="text-right py-2 px-2 font-medium">Cliques</th>
                  <th className="text-right py-2 px-2 font-medium">CTR</th>
                  <th className="text-right py-2 px-2 font-medium">CPC</th>
                  <th className="text-right py-2 px-2 font-medium">CPM</th>
                  <th className="text-right py-2 px-2 font-medium">Gasto</th>
                  <th className="text-right py-2 px-2 font-medium">
                    <Tooltip>
                      <TooltipTrigger className="inline-flex items-center gap-1">
                        Conv.
                        {conversionMode === "tag" && (
                          <Tag className="size-3 text-[#0082FB]" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {conversionMode === "tag"
                          ? "Conversões = leads com a tag configurada atribuídos à campanha/conjunto/anúncio."
                          : "Conversões nativas da Meta API. Configure uma tag pra contar conversões reais do seu CRM."}
                      </TooltipContent>
                    </Tooltip>
                  </th>
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
                      {level === "ad" && (
                        <td className="py-2 px-2">
                          <AdThumb url={r.thumbnailUrl} alt={name} />
                        </td>
                      )}
                      <td className="py-2 px-2 max-w-[280px] truncate" title={name}>{name}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.impressions)}</td>
                      <td className="py-2 px-2 text-right">{fmt(r.clicks)}</td>
                      <td className="py-2 px-2 text-right">{fmtPct(r.ctr)}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(r.cpc)}</td>
                      <td className="py-2 px-2 text-right">{fmtCurrency(r.cpm)}</td>
                      <td className="py-2 px-2 text-right font-medium">{fmtCurrency(r.spend)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className="inline-flex items-center gap-1">
                          {fmt(r.conversions)}
                          {conversionMode === "tag" && (
                            <Badge variant="outline" className="px-1 py-0 text-[9px] uppercase">
                              tag
                            </Badge>
                          )}
                        </span>
                      </td>
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
