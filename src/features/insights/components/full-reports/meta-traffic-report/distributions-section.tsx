"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Seção "Distribuições" do relatório de Tráfego Meta.
 *
 * 4 widgets puxando `metaAds.insightsBreakdown` + `insightsTimeSeries`:
 *  1. Impressões e alcance por idade (BarChart vertical)
 *  2. Impressões e alcance por gênero (PieChart)
 *  3. Alcance por plataforma (PieChart — facebook/instagram/messenger/audience_network)
 *  4. Valor investido por dia (LineChart)
 *
 * Tudo via Meta Marketing API (sem novo escopo OAuth). Quando a conta não
 * estiver conectada ou retornar vazio, mostra estado vazio sem quebrar.
 */
interface Props {
  from: Date;
  to: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const fmtInt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v);

// Paleta consistente com o resto dos relatórios (Meta blue + variações).
const PALETTE = [
  "#0082FB",
  "#7c3aed",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
];

// ─── Charts ───────────────────────────────────────────────────────────────

function ChartCard({
  title,
  children,
  loading,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : empty ? (
          <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
            Sem dados no período
          </div>
        ) : (
          <div className="h-44 w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// Mapeamento de chave Meta → label legível em pt-BR.
const GENDER_LABEL: Record<string, string> = {
  male: "Masculino",
  female: "Feminino",
  unknown: "Não informado",
};
const PLATFORM_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  audience_network: "Audience Network",
};

function AgeChart({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsBreakdown.queryOptions({
      input: {
        breakdown: "age",
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    }),
  );
  const rows = useMemo(() => {
    const r = (data?.rows ?? []).map((row) => ({
      label: row.segment,
      impressions: row.impressions,
      reach: row.reach,
    }));
    // Ordena por faixa etária (string sort funciona pra "18-24", "25-34"...)
    r.sort((a, b) => a.label.localeCompare(b.label));
    return r;
  }, [data]);

  return (
    <ChartCard
      title="Impressões e alcance por idade"
      loading={isLoading}
      empty={rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,130,251,0.08)" }}
            contentStyle={{
              fontSize: 11,
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              background: "hsl(var(--background))",
            }}
            formatter={(value: number, name) => [
              fmtInt(value),
              name === "impressions" ? "Impressões" : "Alcance",
            ]}
          />
          <Bar dataKey="impressions" fill="#0082FB" radius={[2, 2, 0, 0]} />
          <Bar dataKey="reach" fill="#7c3aed" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function GenderChart({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsBreakdown.queryOptions({
      input: {
        breakdown: "gender",
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    }),
  );
  const rows = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        name: GENDER_LABEL[row.segment] ?? row.segment,
        value: row.impressions,
        reach: row.reach,
      })),
    [data],
  );

  return (
    <ChartCard
      title="Impressões e alcance por gênero"
      loading={isLoading}
      empty={rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              fontSize: 11,
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              background: "hsl(var(--background))",
            }}
            formatter={(value: number) => fmtInt(value)}
          />
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={36}
            outerRadius={64}
            paddingAngle={2}
            label={({ name, value }) =>
              `${name}: ${fmtInt(value as number)}`
            }
            labelLine={false}
            style={{ fontSize: 10 }}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function PlatformChart({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsBreakdown.queryOptions({
      input: {
        breakdown: "publisher_platform",
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    }),
  );
  const rows = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        name: PLATFORM_LABEL[row.segment] ?? row.segment,
        value: row.reach,
      })),
    [data],
  );

  return (
    <ChartCard
      title="Alcance por plataforma"
      loading={isLoading}
      empty={rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              fontSize: 11,
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              background: "hsl(var(--background))",
            }}
            formatter={(value: number) => fmtInt(value)}
          />
          <Pie
            data={rows}
            dataKey="value"
            nameKey="name"
            innerRadius={36}
            outerRadius={64}
            paddingAngle={2}
            label={({ name, value }) =>
              `${name}: ${fmtInt(value as number)}`
            }
            labelLine={false}
            style={{ fontSize: 10 }}
          >
            {rows.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function DailySpendChart({ from, to }: Props) {
  const { data, isLoading } = useQuery(
    orpc.metaAds.insightsTimeSeries.queryOptions({
      input: {
        startDate: from.toISOString(),
        endDate: to.toISOString(),
      },
    }),
  );
  const rows = useMemo(
    () =>
      (data?.rows ?? []).map((row) => ({
        label: row.date.slice(5), // MM-DD
        spend: row.spend,
      })),
    [data],
  );

  return (
    <ChartCard
      title="Valor investido por dia"
      loading={isLoading}
      empty={rows.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
          />
          <Tooltip
            cursor={{ stroke: "#0082FB", strokeWidth: 1, opacity: 0.5 }}
            contentStyle={{
              fontSize: 11,
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              background: "hsl(var(--background))",
            }}
            formatter={(value: number) => [fmtCurrency(value), "Investido"]}
            labelFormatter={(label) => `Dia ${label}`}
          />
          <Line
            type="monotone"
            dataKey="spend"
            stroke="#0082FB"
            strokeWidth={2}
            dot={{ r: 2, fill: "#0082FB" }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────

export function DistributionsSection({ from, to }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <AgeChart from={from} to={to} />
      <PlatformChart from={from} to={to} />
      <GenderChart from={from} to={to} />
      <DailySpendChart from={from} to={to} />
    </div>
  );
}
