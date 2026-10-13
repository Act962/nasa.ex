"use client";

import { useState } from "react";
import { formatCents } from "@/features/form-records/lib/measure-units";
import type { RecordsSummary, SummaryBucket } from "@/features/form-records/lib/records-summary";

// Painel da lista de fichas (spec 0075, RF-15): os números do filtro atual.
// Uma cor só nos gráficos: há uma série por gráfico, e os valores ficam em texto.

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const CHART_HEIGHT_PX = 120;

function formatBucketLabel(key: string, granularity: RecordsSummary["granularity"]): string {
  const [year, month, day] = key.split("-");
  return granularity === "month" ? `${MONTH_NAMES[Number(month) - 1]}/${year.slice(2)}` : `${day}/${month}`;
}

const pluralize = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 rounded-[18px] border bg-card p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="truncate text-lg font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
      {detail && <p className="break-words text-[11px] text-muted-foreground sm:text-xs">{detail}</p>}
    </div>
  );
}

function TimelineChart({ buckets, granularity }: { buckets: SummaryBucket[]; granularity: RecordsSummary["granularity"] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const maxCount = Math.max(...buckets.map((bucket) => bucket.recordCount), 1);
  const activeBucket = buckets.find((bucket) => bucket.key === activeKey) ?? null;
  // Rótulo em todas as barras só cabe quando são poucas; senão, primeira, última e algumas no meio.
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));

  return (
    <div className="min-w-0 rounded-[18px] border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">Fichas por {granularity === "month" ? "mês" : "dia"}</p>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {activeBucket
            ? `${formatBucketLabel(activeBucket.key, granularity)} · ${pluralize(activeBucket.recordCount, "ficha", "fichas")} · ${formatCents(activeBucket.usageCents)}`
            : "Passe o mouse ou toque numa barra"}
        </p>
      </div>
      <div className="mt-3 flex items-end gap-0.5" style={{ height: CHART_HEIGHT_PX }} role="img" aria-label={`Fichas por ${granularity === "month" ? "mês" : "dia"}`}>
        {buckets.map((bucket) => (
          <button
            key={bucket.key}
            type="button"
            title={`${formatBucketLabel(bucket.key, granularity)}: ${pluralize(bucket.recordCount, "ficha", "fichas")}, ${formatCents(bucket.usageCents)}`}
            onMouseEnter={() => setActiveKey(bucket.key)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(bucket.key)}
            onBlur={() => setActiveKey(null)}
            onClick={() => setActiveKey(bucket.key)}
            className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
          >
            <span
              className={`block w-full max-w-8 rounded-t-[4px] ${activeKey === bucket.key ? "bg-primary" : "bg-primary/70 group-focus-visible:bg-primary"}`}
              style={{ height: `${Math.max(2, (bucket.recordCount / maxCount) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 border-t pt-1" aria-hidden>
        {buckets.map((bucket, index) => (
          <span key={bucket.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-muted-foreground">
            {index % labelEvery === 0 || index === buckets.length - 1 ? formatBucketLabel(bucket.key, granularity) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankingCard({ title, rows }: { title: string; rows: { key: string; name: string; detail: string; amount: number; amountLabel: string }[] }) {
  if (rows.length === 0) return null;
  const maxAmount = Math.max(...rows.map((row) => row.amount), 1);
  return (
    <div className="min-w-0 rounded-[18px] border bg-card p-3">
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-2 space-y-2">
        {rows.map((row) => (
          <li key={row.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate" title={row.name}>
                {row.name}
              </span>
              <span className="shrink-0 tabular-nums">{row.amountLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(2, (row.amount / maxAmount) * 100)}%` }} />
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{row.detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormRecordsDashboard({ summary }: { summary: RecordsSummary & { isPartial: boolean } }) {
  if (summary.recordCount === 0) return null;
  // Ranking por valor quando há valor; sem itens cobrados, por número de fichas.
  const rankByCount = summary.usageCents === 0;
  const toRankingRows = (rankings: RecordsSummary["topClients"]) =>
    rankings.map((ranking) => ({
      key: ranking.id,
      name: ranking.name,
      detail: pluralize(ranking.recordCount, "ficha", "fichas"),
      amount: rankByCount ? ranking.recordCount : ranking.usageCents,
      amountLabel: rankByCount ? String(ranking.recordCount) : formatCents(ranking.usageCents),
    }));

  return (
    <div className="min-w-0 space-y-3" aria-label="Painel das fichas">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatTile
          label="Fichas"
          value={String(summary.recordCount)}
          detail={`${pluralize(summary.sentCount, "enviada", "enviadas")} · ${pluralize(summary.closedCount, "fechada", "fechadas")} · ${pluralize(summary.draftCount, "rascunho", "rascunhos")}`}
        />
        <StatTile label="Total dos itens" value={formatCents(summary.usageCents)} />
        <StatTile label="Média por ficha" value={formatCents(summary.averageUsageCents)} />
        <StatTile label="Clientes" value={String(summary.clientCount)} detail={summary.clientCount > 0 ? `${(summary.recordCount / summary.clientCount).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} fichas por cliente` : undefined} />
      </div>
      {summary.buckets.length > 1 && <TimelineChart buckets={summary.buckets} granularity={summary.granularity} />}
      <div className="grid gap-3 lg:grid-cols-3">
        <RankingCard title={rankByCount ? "Clientes com mais fichas" : "Clientes com maior valor"} rows={toRankingRows(summary.topClients)} />
        <RankingCard title={rankByCount ? "Vinculados com mais fichas" : "Vinculados com maior valor"} rows={toRankingRows(summary.topMembers)} />
        <RankingCard
          title="Itens mais usados"
          rows={summary.topItems.map((item) => ({
            key: `${item.name}|${item.unit}`,
            name: item.name,
            detail: `${item.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${item.unit}`,
            amount: item.totalCents > 0 ? item.totalCents : item.quantity,
            amountLabel: item.totalCents > 0 ? formatCents(item.totalCents) : "",
          }))}
        />
      </div>
      {summary.isPartial && <p className="text-xs text-muted-foreground">O painel soma as 5.000 fichas mais recentes deste filtro.</p>}
    </div>
  );
}
