"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertCircle,
  ArrowRight,
  DollarSign,
  Eye,
  MousePointerClick,
  Play,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type DatePreset = "today" | "yesterday" | "last_7d" | "last_30d" | "last_90d" | "this_month" | "last_month";

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7d: "Últimos 7 dias",
  last_30d: "Últimos 30 dias",
  last_90d: "Últimos 90 dias",
  this_month: "Este mês",
  last_month: "Mês passado",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number, decimals = 0) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(v);

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, icon: Icon, color, loading,
}: {
  label: string; value: string; sub?: string;
  icon: React.FC<{ className?: string }>;
  color: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-7 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, description, color }: {
  icon: string; title: string; description: string; color: string;
}) {
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-xl border-l-4", color)}>
      <span className="text-2xl">{icon}</span>
      <div>
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ─── Not Connected State ──────────────────────────────────────────────────────

function NotConnected() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#0082FB]/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-[#0082FB]" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 00.265.86 5.297 5.297 0 00.371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.18.291l2.308 3.597c.924 1.44 1.977 2.754 3.236 3.66 1.416 1.03 2.92 1.436 4.558 1.436 1.724 0 3.345-.539 4.421-1.57.966-.927 1.548-2.216 1.548-3.793 0-2.89-1.386-5.553-3.5-7.577-2.071-1.982-5.131-3.502-9.063-3.502-3.244 0-5.906.905-7.944 2.362" />
        </svg>
      </div>
      <div>
        <h3 className="font-semibold">Meta Ads não conectado</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          Configure sua integração com a Meta para visualizar dados de campanhas, alcance, custos e conversões.
        </p>
      </div>
      <Button asChild size="sm" className="gap-1.5">
        <Link href="/integrations">
          Conectar Meta Ads <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MetaInsights() {
  const [datePreset, setDatePreset] = useState<DatePreset>("last_30d");

  const { data, isLoading, refetch, isRefetching } = useQuery(
    orpc.channelInsights.meta.queryOptions({
      input: { datePreset, level: "account" },
    }),
  );

  if (!isLoading && !data?.connected) return <NotConnected />;

  const d = data?.data;
  const loading = isLoading || isRefetching;

  if (!isLoading && data?.error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="size-8 text-destructive" />
        <div>
          <h3 className="font-semibold">Erro ao carregar dados</h3>
          <p className="text-sm text-muted-foreground mt-1">{data.error}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="size-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-[#0082FB]/40 text-[#0082FB] bg-[#0082FB]/5 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0082FB] animate-pulse" />
            Meta Ads
          </Badge>
          <span className="text-sm text-muted-foreground">Dados da conta de anúncios</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_PRESET_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={loading} className="h-8 w-8 p-0">
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* 📊 Alcance e Entrega */}
      <section>
        <SectionHeader icon="📊" title="Alcance e Entrega"
          description="Quantas pessoas seu anúncio alcançou e quantas vezes foi exibido"
          color="border-blue-500 bg-blue-50/50 dark:bg-blue-950/20" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <KPICard label="Alcance" value={d ? fmt(d.reach) : "—"}
            sub="Pessoas únicas que viram o anúncio"
            icon={Users} color="bg-blue-100 text-blue-600 dark:bg-blue-900/40" loading={loading} />
          <KPICard label="Impressões" value={d ? fmt(d.impressions) : "—"}
            sub="Total de exibições (inclui repetições)"
            icon={Eye} color="bg-sky-100 text-sky-600 dark:bg-sky-900/40" loading={loading} />
          <KPICard label="Frequência" value={d ? d.frequency.toFixed(2) : "—"}
            sub="Média de vezes que cada pessoa viu"
            icon={RefreshCw} color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40" loading={loading} />
        </div>
      </section>

      {/* 👆 Engajamento */}
      <section>
        <SectionHeader icon="👆" title="Engajamento"
          description="Cliques, CTR e interações orgânicas geradas pelos anúncios"
          color="border-purple-500 bg-purple-50/50 dark:bg-purple-950/20" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <KPICard label="Cliques" value={d ? fmt(d.clicks) : "—"}
            sub="Total de cliques no anúncio"
            icon={MousePointerClick} color="bg-purple-100 text-purple-600 dark:bg-purple-900/40" loading={loading} />
          <KPICard label="CTR" value={d ? fmtPct(d.ctr) : "—"}
            sub="% de impressões que geraram clique"
            icon={TrendingUp} color="bg-violet-100 text-violet-600 dark:bg-violet-900/40" loading={loading} />
          <KPICard label="Engajamento" value={d ? fmt(d.engagement) : "—"}
            sub="Curtidas, comentários, compartilhamentos"
            icon={TrendingUp} color="bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40" loading={loading} />
        </div>
      </section>

      {/* 💰 Custos */}
      <section>
        <SectionHeader icon="💰" title="Custos"
          description="Métricas de custo por tipo de interação e aquisição"
          color="border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
          <KPICard label="Investimento total" value={d ? fmtCurrency(d.spend) : "—"}
            sub="Gasto total no período"
            icon={DollarSign} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40" loading={loading} />
          <KPICard label="CPM" value={d ? fmtCurrency(d.cpm) : "—"}
            sub="Custo por 1.000 impressões"
            icon={DollarSign} color="bg-teal-100 text-teal-600 dark:bg-teal-900/40" loading={loading} />
          <KPICard label="CPC" value={d ? fmtCurrency(d.cpc) : "—"}
            sub="Custo por clique"
            icon={DollarSign} color="bg-green-100 text-green-600 dark:bg-green-900/40" loading={loading} />
          <KPICard label="CPL" value={d ? fmtCurrency(d.cpl) : "—"}
            sub="Custo por lead captado"
            icon={Target} color="bg-lime-100 text-lime-600 dark:bg-lime-900/40" loading={loading} />
          <KPICard label="CPA" value={d ? fmtCurrency(d.cpa) : "—"}
            sub="Custo por aquisição/conversão"
            icon={Target} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40" loading={loading} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <KPICard label="CPV" value={d ? fmtCurrency(d.cpv) : "—"}
            sub="Custo por visualização de vídeo"
            icon={Play} color="bg-orange-100 text-orange-600 dark:bg-orange-900/40" loading={loading} />
        </div>
      </section>

      {/* 🎯 Conversão */}
      <section>
        <SectionHeader icon="🎯" title="Conversão"
          description="Resultados e retorno sobre o investimento em anúncios"
          color="border-rose-500 bg-rose-50/50 dark:bg-rose-950/20" />
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <KPICard label="Conversões" value={d ? fmt(d.conversions) : "—"}
            sub="Ações concluídas (compras, cadastros)"
            icon={Target} color="bg-rose-100 text-rose-600 dark:bg-rose-900/40" loading={loading} />
          <KPICard label="Taxa de conversão" value={d ? fmtPct(d.conversionRate) : "—"}
            sub="% de cliques → conversão"
            icon={TrendingUp} color="bg-red-100 text-red-600 dark:bg-red-900/40" loading={loading} />
          <KPICard label="ROAS" value={d ? `${d.roas.toFixed(2)}x` : "—"}
            sub="Retorno por R$1 investido"
            icon={TrendingUp} color="bg-pink-100 text-pink-600 dark:bg-pink-900/40" loading={loading} />
          <KPICard label="Valor de conversão" value={d ? fmtCurrency(d.conversionValue) : "—"}
            sub="Receita total gerada pelos anúncios"
            icon={DollarSign} color="bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-900/40" loading={loading} />
        </div>
      </section>

      {/* 🎬 Vídeo */}
      <section>
        <SectionHeader icon="🎬" title="Vídeo"
          description="Métricas de desempenho de anúncios em vídeo"
          color="border-amber-500 bg-amber-50/50 dark:bg-amber-950/20" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
          <KPICard label="Visualizações" value={d ? fmt(d.videoPlays) : "—"}
            sub="Vezes que o vídeo foi iniciado"
            icon={Play} color="bg-amber-100 text-amber-600 dark:bg-amber-900/40" loading={loading} />
          <KPICard label="ThruPlay" value={d ? fmt(d.thruPlays) : "—"}
            sub="Vídeos assistidos até o fim ou 15s+"
            icon={Play} color="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/40" loading={loading} />
          <KPICard label="Taxa de retenção" value={d ? fmtPct(d.videoRetention) : "—"}
            sub="% do vídeo assistido em média"
            icon={TrendingUp} color="bg-orange-100 text-orange-600 dark:bg-orange-900/40" loading={loading} />
        </div>
      </section>
    </div>
  );
}
