"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { OrbitaSpinner } from "@/components/orbita-spinner";
import { cn } from "@/lib/utils";
import { useTrafegoAccountBreakdown } from "@/features/trafego/hooks/use-trafego-performance";
import type { PerformanceBreakdown, PerformanceRange } from "@/features/trafego/lib/order-meta-metrics";

/** Blocos do Desempenho pela conta do cliente: gráfico diário, campanhas e públicos (spec 0122, RF-12). */

export function formatMoneyFromCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(cents / 100);
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CAMPAIGN_PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problema",
};

const SEGMENT_LABEL: Record<string, string> = {
  female: "Mulheres",
  male: "Homens",
  unknown: "Não informado",
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
  threads: "Threads",
};

const BREAKDOWN_TABS: { key: PerformanceBreakdown; label: string }[] = [
  { key: "age", label: "Idade" },
  { key: "gender", label: "Gênero" },
  { key: "publisher_platform", label: "Plataforma" },
];

const dailyChartConfig = {
  spendCents: { label: "Investido", color: "var(--primary)" },
} satisfies ChartConfig;

export function DailySpendChart({
  series,
  currency,
}: {
  series: { date: string; spendCents: number; conversations: number }[];
  currency: string;
}) {
  if (series.length === 0) return null;
  const chartData = series.map((point) => ({
    ...point,
    label: new Date(`${point.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
  }));

  return (
    <div className="rounded-[20px] border bg-card p-4">
      <p className="text-sm font-medium">Investido por dia</p>
      <ChartContainer config={dailyChartConfig} className="mt-3 aspect-auto h-40 w-full">
        <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={16} fontSize={11} />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => (
                  <span className="tabular-nums">
                    {formatMoneyFromCents(Number(value), currency)}
                    {" · "}
                    {Number(item.payload.conversations).toLocaleString("pt-BR")} conversas
                  </span>
                )}
              />
            }
          />
          <Bar dataKey="spendCents" fill="var(--color-spendCents)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function AccountCampaignList({
  campaigns,
  currency,
  orderCode,
  isTruncated,
}: {
  campaigns: {
    id: string;
    name: string;
    status: string | null;
    spendCents: number;
    conversations: number;
    isOrderCampaign: boolean;
  }[];
  currency: string;
  orderCode: string;
  isTruncated: boolean;
}) {
  return (
    <div className="rounded-[20px] border bg-card p-4">
      <p className="text-sm font-medium">Campanhas da conta no período</p>
      {campaigns.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nenhuma campanha veiculou no período.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {campaigns.map((campaign) => (
            <li key={campaign.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm">{campaign.name}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {campaign.status ? (CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status) : "—"}
                  {campaign.isOrderCampaign && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      deste pedido · {orderCode}
                    </span>
                  )}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm tabular-nums">{formatMoneyFromCents(campaign.spendCents, currency)}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  {campaign.conversations.toLocaleString("pt-BR")} conversas
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {isTruncated && (
        <p className="mt-2 text-xs text-muted-foreground">Mostrando as campanhas mais recentes da conta.</p>
      )}
    </div>
  );
}

export function AccountBreakdownSection({
  orderId,
  range,
  currency,
}: {
  orderId: string;
  range: PerformanceRange;
  currency: string;
}) {
  const [activeBreakdown, setActiveBreakdown] = useState<PerformanceBreakdown>("age");
  const { data, isLoading } = useTrafegoAccountBreakdown(orderId, range, activeBreakdown);
  const rows = data?.mode === "account" ? data.rows : [];
  const maxSpend = Math.max(...rows.map((row) => row.spendCents), 1);

  return (
    <div className="rounded-[20px] border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Quem foi alcançado</p>
        <div className="flex gap-1">
          {BREAKDOWN_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveBreakdown(tab.key)}
              className={cn(
                "min-h-8 rounded-full px-3 text-xs transition",
                activeBreakdown === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <OrbitaSpinner className="size-3.5" /> Carregando…
        </p>
      ) : data && data.mode !== "account" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {"message" in data ? data.message : "Indisponível para este pedido."}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Sem dados no período.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.segment} className="text-xs">
              <div className="flex justify-between gap-2">
                <span>{SEGMENT_LABEL[row.segment] ?? row.segment}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoneyFromCents(row.spendCents, currency)} · {row.reach.toLocaleString("pt-BR")} pessoas
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(row.spendCents / maxSpend) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Mostra para quem a Meta entregou os anúncios, não o perfil de quem é cliente.
      </p>
    </div>
  );
}
