"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Paleta de cores — uma por campanha (cicla se passar de 12)
const COLORS = [
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#3B82F6", // blue
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#14B8A6", // teal
  "#F97316", // orange
  "#84CC16", // lime
  "#6366F1", // indigo
];

export type Point = {
  reportId: string;
  savedAt: string;
  spend: number;
  leads: number;
  conversions: number;
  roas: number;
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  impressions: number;
  reach: number;
  clicks: number;
};

export type Campaign = {
  metaCampaignId: string;
  name: string;
  points: Point[];
};

export type Report = {
  id: string;
  name: string;
  savedAt: string;
};

export type KpiKey =
  | "spend"
  | "leads"
  | "conversions"
  | "roas"
  | "ctr"
  | "cpc"
  | "cpm"
  | "cpa"
  | "impressions"
  | "reach"
  | "clicks";

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) =>
  `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v)}%`;
const fmtDecimal = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);

const FORMATTERS: Record<KpiKey, (v: number) => string> = {
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

export function CampaignsEvolutionChart({
  reports,
  campaigns,
  kpi,
  visibleCampaignIds,
}: {
  reports: Report[];
  campaigns: Campaign[];
  kpi: KpiKey;
  visibleCampaignIds: Set<string>;
}) {
  // Pivota os dados — cada linha do dataset = um relatório, com colunas por campanha
  const data = useMemo(() => {
    return reports.map((r) => {
      const row: Record<string, string | number> = {
        reportId: r.id,
        label: r.name,
        savedAt: new Date(r.savedAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
      };
      for (const c of campaigns) {
        const pt = c.points.find((p) => p.reportId === r.id);
        if (pt) {
          row[c.metaCampaignId] = pt[kpi];
        }
      }
      return row;
    });
  }, [reports, campaigns, kpi]);

  const fmt = FORMATTERS[kpi];

  if (reports.length === 0 || campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center h-[320px] rounded-lg border border-dashed text-sm text-muted-foreground">
        Selecione pelo menos 2 relatórios com campanhas para visualizar a
        evolução.
      </div>
    );
  }

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="savedAt"
            tick={{ fontSize: 11 }}
            tickLine={false}
            stroke="currentColor"
            className="text-muted-foreground"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            stroke="currentColor"
            className="text-muted-foreground"
            tickFormatter={(v) => fmt(Number(v))}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--card))",
            }}
            formatter={(value: number, name: string) => {
              const camp = campaigns.find((c) => c.metaCampaignId === name);
              return [fmt(value), camp?.name ?? name];
            }}
            labelFormatter={(label, payload) => {
              const reportLabel =
                (payload && payload[0]?.payload?.label) || label;
              return reportLabel;
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) => {
              const camp = campaigns.find((c) => c.metaCampaignId === value);
              return camp?.name ?? value;
            }}
          />
          {campaigns.map((c, i) => {
            const visible = visibleCampaignIds.has(c.metaCampaignId);
            return (
              <Line
                key={c.metaCampaignId}
                type="monotone"
                dataKey={c.metaCampaignId}
                stroke={COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                hide={!visible}
                connectNulls
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export { COLORS as CAMPAIGN_COLORS };
