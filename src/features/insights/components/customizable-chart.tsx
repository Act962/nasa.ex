"use client";

import { useState, useMemo, useId } from "react";
import {
  ComposedChart, Bar, Line, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Plus, Trash2, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AppModule } from "./app-selector";

// ─── Types ───────────────────────────────────────────────────────────────────

type SeriesChartType = "bar" | "line" | "area";
type GlobalChartType = "composed" | "pie" | "pictogram" | "bar-h";

interface DataPoint { name: string; value: number; color?: string }

interface Dataset {
  id: string;
  label: string;
  shortLabel: string;
  data: DataPoint[];
}

interface Series {
  id: string;
  datasetId: string;
  chartType: SeriesChartType;
  color: string;
}

interface CustomizableChartProps {
  selectedModules: AppModule[];
  tracking?: { totalLeads: number; wonLeads: number; activeLeads: number; conversionRate?: number };
  chat?: {
    totalConversations: number; totalMessages: number;
    attendedConversations: number; unattendedConversations: number; attendanceRate?: number;
  };
  forge?: {
    totalProposals: number; rascunho: number; enviadas: number; visualizadas: number;
    pagas: number; expiradas: number; canceladas: number;
    revenueTotal: number; revenuePipeline: number;
  };
  spacetime?: {
    total: number; pending: number; confirmed: number;
    done: number; cancelled: number; noShow: number; conversionRate?: number;
  };
  nasaPost?: { total: number; draft: number; published: number; scheduled: number };
  metaAds?: { spend?: number; roas?: number; leads?: number; clicks?: number; impressions?: number; cpl?: number };
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const SERIES_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#ec4899", "#8b5cf6", "#f97316",
];

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-bold text-foreground">{Number(p.value).toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart type pill ─────────────────────────────────────────────────────────

const SERIES_TYPE_OPTS: { id: SeriesChartType; label: string; icon: string }[] = [
  { id: "bar",  label: "Colunas", icon: "▐▐" },
  { id: "line", label: "Linha",   icon: "∿"  },
  { id: "area", label: "Área",    icon: "◿"  },
];

const GLOBAL_TYPE_OPTS: { id: GlobalChartType; label: string; icon: string }[] = [
  { id: "composed",  label: "Múltiplas séries", icon: "⧈"  },
  { id: "pie",       label: "Pizza",            icon: "◕"  },
  { id: "bar-h",     label: "Barras",           icon: "═"  },
  { id: "pictogram", label: "Pictograma",       icon: "⬛" },
];

// ─── Pictogram ───────────────────────────────────────────────────────────────

function PictogramChart({ data }: { data: DataPoint[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const MAX_ICONS = 40;
  return (
    <div className="flex flex-col gap-3 py-2">
      {data.map((d, i) => {
        const icons = Math.max(1, Math.round((d.value / max) * MAX_ICONS));
        return (
          <div key={d.name} className="flex items-center gap-2">
            <span className="text-[11px] font-medium w-24 text-right shrink-0 text-muted-foreground truncate">{d.name}</span>
            <div className="flex flex-wrap gap-0.5 flex-1">
              {Array.from({ length: icons }).map((_, j) => (
                <div key={j} className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: d.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }} />
              ))}
            </div>
            <span className="text-[11px] font-bold w-12 text-right shrink-0">{d.value.toLocaleString("pt-BR")}</span>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground text-right mt-1">
        Cada ■ ≈ {Math.ceil(max / MAX_ICONS).toLocaleString("pt-BR")} unidades
      </p>
    </div>
  );
}

// ─── Build unified data (merge multiple series X-axes) ────────────────────────

function buildUnifiedData(seriesList: Series[], datasets: Dataset[]) {
  const nameSet = new Set<string>();
  for (const s of seriesList) {
    const ds = datasets.find((d) => d.id === s.datasetId);
    ds?.data.forEach((p) => nameSet.add(p.name));
  }
  return Array.from(nameSet).map((name) => {
    const row: Record<string, any> = { name };
    for (const s of seriesList) {
      const ds = datasets.find((d) => d.id === s.datasetId);
      const pt = ds?.data.find((p) => p.name === name);
      row[s.id] = pt?.value ?? 0;
    }
    return row;
  });
}

// ─── Cross-data insight tiles ────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

interface InsightTile {
  key: string;
  icon: React.FC<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  borderColor: string;
  bgColor: string;
  title: string;
  subtitle: string;
  trend?: "up" | "down" | "neutral";
}

function CrossInsightTiles({ tracking, chat, forge, spacetime, metaAds }: Pick<CustomizableChartProps, "tracking" | "chat" | "forge" | "spacetime" | "metaAds">) {
  const tiles: InsightTile[] = [];

  // Tracking → Forge
  if (tracking && forge) {
    const pct = tracking.totalLeads > 0
      ? (forge.pagas / tracking.totalLeads) * 100
      : 0;
    tiles.push({
      key: "leads-forge",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
      borderColor: "border-emerald-200 dark:border-emerald-900",
      bgColor: "bg-emerald-50/60 dark:bg-emerald-950/20",
      title: `${fmtPct(pct)} dos leads resultaram em proposta paga`,
      subtitle: `${fmt(forge.totalProposals)} propostas geradas · ${fmt(forge.pagas)} pagas · ${fmtBRL(forge.revenueTotal)} em receita fechada`,
      trend: pct > 10 ? "up" : "neutral",
    });
  }

  // Chat attendance
  if (chat) {
    const unattended = chat.totalConversations - chat.attendedConversations;
    const rate = chat.attendanceRate ?? (chat.totalConversations > 0 ? (chat.attendedConversations / chat.totalConversations) * 100 : 0);
    tiles.push({
      key: "chat-attendance",
      icon: unattended > 0 ? AlertCircle : CheckCircle2,
      iconColor: unattended > 0 ? "text-amber-600" : "text-emerald-600",
      iconBg: unattended > 0 ? "bg-amber-50 dark:bg-amber-950/40" : "bg-emerald-50 dark:bg-emerald-950/40",
      borderColor: unattended > 0 ? "border-amber-200 dark:border-amber-900" : "border-emerald-200 dark:border-emerald-900",
      bgColor: unattended > 0 ? "bg-amber-50/60 dark:bg-amber-950/20" : "bg-emerald-50/60 dark:bg-emerald-950/20",
      title: `Taxa de atendimento: ${fmtPct(rate)}`,
      subtitle: `${fmt(chat.totalMessages)} mensagens · ${fmt(chat.attendedConversations)} atendidas · ${fmt(unattended)} sem atendimento`,
      trend: rate > 80 ? "up" : rate < 50 ? "down" : "neutral",
    });
  }

  // SpaceTime conversion
  if (spacetime) {
    const rate = spacetime.conversionRate ?? (spacetime.total > 0 ? (spacetime.done / spacetime.total) * 100 : 0);
    tiles.push({
      key: "spacetime-conv",
      icon: CheckCircle2,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50 dark:bg-blue-950/40",
      borderColor: "border-blue-200 dark:border-blue-900",
      bgColor: "bg-blue-50/60 dark:bg-blue-950/20",
      title: `${fmtPct(rate)} dos agendamentos foram realizados`,
      subtitle: `${fmt(spacetime.total)} agendados · ${fmt(spacetime.done)} realizados · ${fmt(spacetime.noShow)} no-show`,
      trend: rate > 70 ? "up" : "neutral",
    });
  }

  // Meta Ads → Chat
  if (metaAds?.spend !== undefined && chat) {
    const unattended = chat.totalConversations - chat.attendedConversations;
    if (unattended > 0) {
      tiles.push({
        key: "meta-chat",
        icon: AlertCircle,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-50 dark:bg-amber-950/40",
        borderColor: "border-amber-200 dark:border-amber-900",
        bgColor: "bg-amber-50/60 dark:bg-amber-950/20",
        title: `Investimento Meta Ads × Atendimento`,
        subtitle: `${fmtBRL(metaAds.spend ?? 0)} investidos · ${fmt(metaAds.leads ?? 0)} leads gerados · mas ${fmt(unattended)} conversas ficaram sem atendimento`,
        trend: "down",
      });
    }
  }

  // Meta ROI
  if (metaAds?.roas !== undefined) {
    tiles.push({
      key: "meta-roas",
      icon: TrendingUp,
      iconColor: (metaAds.roas ?? 0) > 2 ? "text-emerald-600" : "text-amber-600",
      iconBg: (metaAds.roas ?? 0) > 2 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-amber-50 dark:bg-amber-950/40",
      borderColor: (metaAds.roas ?? 0) > 2 ? "border-emerald-200 dark:border-emerald-900" : "border-amber-200 dark:border-amber-900",
      bgColor: (metaAds.roas ?? 0) > 2 ? "bg-emerald-50/60 dark:bg-emerald-950/20" : "bg-amber-50/60 dark:bg-amber-950/20",
      title: `ROAS ${(metaAds.roas ?? 0).toFixed(2)}x · ${fmtBRL(metaAds.spend ?? 0)} investidos`,
      subtitle: `${fmt(metaAds.leads ?? 0)} leads · CPL ${fmtBRL(metaAds.cpl ?? 0)} · ${fmt(metaAds.clicks ?? 0)} cliques`,
      trend: (metaAds.roas ?? 0) > 2 ? "up" : "neutral",
    });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="space-y-2 pt-2">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Cruzamentos</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map((t) => (
          <div
            key={t.key}
            className={cn("flex items-start gap-2.5 p-3 rounded-xl border", t.bgColor, t.borderColor)}
          >
            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", t.iconBg)}>
              <t.icon className={cn("size-3.5", t.iconColor)} />
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight">{t.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

let _id = 0;
function genId() { return `s${++_id}`; }

export function CustomizableChart({
  selectedModules,
  tracking,
  chat,
  forge,
  spacetime,
  nasaPost,
  metaAds,
}: CustomizableChartProps) {
  const [globalType, setGlobalType] = useState<GlobalChartType>("composed");
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  // Build available datasets
  const datasets = useMemo<Dataset[]>(() => {
    const result: Dataset[] = [];
    if (selectedModules.includes("tracking") && tracking) {
      result.push({ id: "tracking-leads", label: "Tracking — Leads", shortLabel: "Leads", data: [
        { name: "Total", value: tracking.totalLeads, color: "#6366f1" },
        { name: "Ativos", value: tracking.activeLeads, color: "#10b981" },
        { name: "Ganhos", value: tracking.wonLeads, color: "#f59e0b" },
      ]});
    }
    if (selectedModules.includes("chat") && chat) {
      result.push({ id: "chat-atend", label: "Chat — Atendimento", shortLabel: "Chat", data: [
        { name: "Mensagens", value: chat.totalMessages, color: "#8b5cf6" },
        { name: "Conversas", value: chat.totalConversations, color: "#6366f1" },
        { name: "Atendidas", value: chat.attendedConversations, color: "#10b981" },
        { name: "Não atendidas", value: chat.unattendedConversations, color: "#ef4444" },
      ]});
    }
    if (selectedModules.includes("forge") && forge) {
      result.push({ id: "forge-status", label: "Forge — Propostas", shortLabel: "Propostas", data: [
        { name: "Rascunho",   value: forge.rascunho,   color: "#94a3b8" },
        { name: "Enviadas",   value: forge.enviadas,   color: "#3b82f6" },
        { name: "Visualizadas", value: forge.visualizadas, color: "#6366f1" },
        { name: "Pagas",      value: forge.pagas,      color: "#10b981" },
        { name: "Expiradas",  value: forge.expiradas,  color: "#f59e0b" },
        { name: "Canceladas", value: forge.canceladas, color: "#ef4444" },
      ]});
      result.push({ id: "forge-receita", label: "Forge — Receita (R$)", shortLabel: "Receita", data: [
        { name: "Fechada",  value: forge.revenueTotal,    color: "#10b981" },
        { name: "Pipeline", value: forge.revenuePipeline, color: "#3b82f6" },
      ]});
    }
    if (selectedModules.includes("spacetime") && spacetime) {
      result.push({ id: "spacetime-status", label: "SpaceTime — Agendamentos", shortLabel: "Agendamentos", data: [
        { name: "Total",      value: spacetime.total,     color: "#3b82f6" },
        { name: "Realizados", value: spacetime.done,      color: "#10b981" },
        { name: "Confirmados", value: spacetime.confirmed, color: "#6366f1" },
        { name: "Pendentes",  value: spacetime.pending,   color: "#f59e0b" },
        { name: "Cancelados", value: spacetime.cancelled, color: "#ef4444" },
        { name: "No-show",    value: spacetime.noShow,    color: "#f97316" },
      ]});
    }
    if (selectedModules.includes("nasa-post") && nasaPost) {
      result.push({ id: "nasapost-status", label: "NASA Post — Conteúdo", shortLabel: "Posts", data: [
        { name: "Total",      value: nasaPost.total,     color: "#ec4899" },
        { name: "Publicados", value: nasaPost.published, color: "#10b981" },
        { name: "Agendados",  value: nasaPost.scheduled, color: "#3b82f6" },
        { name: "Rascunhos",  value: nasaPost.draft,     color: "#94a3b8" },
      ]});
    }
    if (selectedModules.includes("integrations") && metaAds?.spend !== undefined) {
      result.push({ id: "meta-ads", label: "Meta Ads — Leads & Cliques", shortLabel: "Meta Ads", data: [
        { name: "Leads",    value: metaAds.leads ?? 0,   color: "#0082FB" },
        { name: "Cliques",  value: metaAds.clicks ?? 0,  color: "#3b82f6" },
      ]});
    }
    return result;
  }, [selectedModules, tracking, chat, forge, spacetime, nasaPost, metaAds]);

  // Initialize series with first dataset when datasets load
  const activeSeries: Series[] = seriesList.length > 0
    ? seriesList.filter((s) => datasets.find((d) => d.id === s.datasetId))
    : datasets.length > 0
      ? [{ id: genId(), datasetId: datasets[0].id, chartType: "bar", color: SERIES_COLORS[0] }]
      : [];

  const addSeries = () => {
    const usedIds = new Set(activeSeries.map((s) => s.datasetId));
    const next = datasets.find((d) => !usedIds.has(d.id)) ?? datasets[0];
    if (!next) return;
    const idx = activeSeries.length % SERIES_COLORS.length;
    setSeriesList([...activeSeries, { id: genId(), datasetId: next.id, chartType: "line", color: SERIES_COLORS[idx] }]);
  };

  const removeSeries = (id: string) => {
    const updated = activeSeries.filter((s) => s.id !== id);
    setSeriesList(updated);
  };

  const updateSeries = (id: string, patch: Partial<Series>) => {
    setSeriesList(activeSeries.map((s) => s.id === id ? { ...s, ...patch } : s));
  };

  if (datasets.length === 0) return null;

  // Unified chart data
  const unifiedData = buildUnifiedData(activeSeries, datasets);

  // For single-series special modes (pie, pictogram, bar-h)
  const firstDataset = datasets.find((d) => d.id === (activeSeries[0]?.datasetId ?? "")) ?? datasets[0];
  const firstData = firstDataset?.data ?? [];

  const CHART_H = 300;

  const renderChart = () => {
    // Pie — single series
    if (globalType === "pie") {
      const pieData = firstData.map((d, i) => ({ ...d, fill: d.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }));
      return (
        <ResponsiveContainer width="100%" height={CHART_H}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine>
              {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    // Pictogram — single series
    if (globalType === "pictogram") return <PictogramChart data={firstData} />;

    // Horizontal bars — single series
    if (globalType === "bar-h") {
      const data = firstData.map((d, i) => ({ name: d.name, value: d.value, fill: d.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }));
      return (
        <ResponsiveContainer width="100%" height={Math.max(CHART_H, firstData.length * 52)}>
          <ComposedChart data={data} layout="vertical" margin={{ left: 80, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
            <Tooltip content={<CustomTooltip />} />
            {data.map((_, i) => null)}
            <Bar dataKey="value" name="Valor" radius={[0, 6, 6, 0]}>
              {data.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    // Composed — multiple series with individual chart types
    return (
      <ResponsiveContainer width="100%" height={CHART_H}>
        <ComposedChart data={unifiedData} margin={{ left: 0, right: 20, top: 10 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          {activeSeries.map((s) => {
            const ds = datasets.find((d) => d.id === s.datasetId);
            const name = ds?.shortLabel ?? s.id;
            if (s.chartType === "line") {
              return <Line key={s.id} type="monotone" dataKey={s.id} name={name} stroke={s.color} strokeWidth={2.5} dot={{ r: 4, fill: s.color }} activeDot={{ r: 6 }} />;
            }
            if (s.chartType === "area") {
              return <Area key={s.id} type="monotone" dataKey={s.id} name={name} stroke={s.color} strokeWidth={2} fill={s.color + "25"} />;
            }
            // bar
            return <Bar key={s.id} dataKey={s.id} name={name} fill={s.color} radius={[5, 5, 0, 0]} maxBarSize={48} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="w-full rounded-2xl border bg-card overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b bg-muted/20 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Gráfico Personalizado</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Combine indicadores de apps diferentes com tipos de gráfico independentes</p>
          </div>
          {/* Global mode pills */}
          <div className="flex flex-wrap gap-1 shrink-0">
            {GLOBAL_TYPE_OPTS.map((g) => (
              <button key={g.id} onClick={() => setGlobalType(g.id)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors",
                  globalType === g.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted border-transparent",
                )}>
                <span className="font-mono text-[10px]">{g.icon}</span> {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Series manager — only in composed mode */}
        {globalType === "composed" && (
          <div className="space-y-2">
            {activeSeries.map((s, idx) => {
              const ds = datasets.find((d) => d.id === s.datasetId);
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border bg-background">
                  {/* Color dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />

                  {/* Dataset picker */}
                  <select
                    className="text-[11px] border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring flex-1 min-w-0"
                    value={s.datasetId}
                    onChange={(e) => updateSeries(s.id, { datasetId: e.target.value })}
                  >
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>

                  {/* Chart type for this series */}
                  <div className="flex gap-1">
                    {SERIES_TYPE_OPTS.map((t) => (
                      <button key={t.id} onClick={() => updateSeries(s.id, { chartType: t.id })}
                        className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors",
                          s.chartType === t.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted border-transparent",
                        )}>
                        <span className="font-mono">{t.icon}</span>
                        <span className="hidden sm:inline">{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Remove */}
                  {activeSeries.length > 1 && (
                    <button onClick={() => removeSeries(s.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addSeries} className="gap-1.5 text-xs w-full mt-1"
              disabled={activeSeries.length >= datasets.length}>
              <Plus className="size-3.5" /> Adicionar série
            </Button>
          </div>
        )}

        {/* Single-series dataset selector for pie/pictogram/bar-h */}
        {globalType !== "composed" && (
          <select
            className="text-xs border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring w-full sm:w-auto"
            value={activeSeries[0]?.datasetId ?? datasets[0]?.id}
            onChange={(e) => {
              const updated = [{ ...(activeSeries[0] ?? { id: genId(), chartType: "bar" as SeriesChartType, color: SERIES_COLORS[0] }), datasetId: e.target.value }];
              setSeriesList(updated);
            }}
          >
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        )}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4">
        {renderChart()}
      </div>

      {/* ── Cross-data insights ────────────────────────────────────────────── */}
      <div className="px-5 pb-5">
        <CrossInsightTiles
          tracking={tracking}
          chat={chat}
          forge={forge}
          spacetime={spacetime}
          metaAds={metaAds}
        />
      </div>
    </div>
  );
}
