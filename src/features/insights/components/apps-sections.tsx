"use client";

import { cn } from "@/lib/utils";
import {
  Flame, Calendar, Sparkles, Plug,
  FileText, CheckCircle2, XCircle, Clock,
  DollarSign, Instagram, Twitter, Facebook,
  MessageSquare, Users, TrendingUp, AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Shared KPI Card ─────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  sub?: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

function KpiCard({ label, value, icon: Icon, color, bg, sub, badge, badgeVariant }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("size-4", color)} />
        </div>
        {badge && <Badge variant={badgeVariant ?? "secondary"} className="text-[10px]">{badge}</Badge>}
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/80 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, label, color, bg, description }: {
  icon: React.FC<{ className?: string }>;
  label: string;
  color: string;
  bg: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", bg)}>
        <Icon className={cn("size-5", color)} />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{label}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

function fmt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// ─── Forge Section ───────────────────────────────────────────────────────────

interface ForgeData {
  totalProposals: number;
  rascunho: number;
  enviadas: number;
  visualizadas: number;
  pagas: number;
  expiradas: number;
  canceladas: number;
  revenueTotal: number;
  revenuePipeline: number;
  totalContracts: number;
  contractsAtivo: number;
}

export function ForgeSection({ data }: { data: ForgeData }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Flame}
        label="Forge — Propostas & Contratos"
        color="text-orange-600"
        bg="bg-orange-50 dark:bg-orange-950/40"
        description="Propostas comerciais geradas e contratos assinados no período"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de propostas" value={fmt(data.totalProposals)}
          icon={FileText} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-950/40" />
        <KpiCard label="Propostas pagas" value={fmt(data.pagas)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={data.totalProposals > 0 ? `${((data.pagas / data.totalProposals) * 100).toFixed(0)}%` : "0%"}
          badgeVariant="default" />
        <KpiCard label="Receita fechada" value={fmtBRL(data.revenueTotal)}
          icon={DollarSign} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          sub="Propostas com status PAGA" />
        <KpiCard label="Pipeline em aberto" value={fmtBRL(data.revenuePipeline)}
          icon={TrendingUp} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/40"
          sub="Enviadas + Visualizadas" />
        <KpiCard label="Enviadas" value={fmt(data.enviadas)}
          icon={FileText} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Visualizadas" value={fmt(data.visualizadas)}
          icon={FileText} color="text-indigo-500" bg="bg-indigo-50 dark:bg-indigo-950/40" />
        <KpiCard label="Expiradas" value={fmt(data.expiradas)}
          icon={Clock} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40" />
        <KpiCard label="Canceladas" value={fmt(data.canceladas)}
          icon={XCircle} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40" />
      </div>
    </div>
  );
}

// ─── SpaceTime Section ───────────────────────────────────────────────────────

interface SpacetimeData {
  total: number;
  pending: number;
  confirmed: number;
  done: number;
  cancelled: number;
  noShow: number;
  withLead: number;
  conversionRate: number;
}

export function SpacetimeSection({ data }: { data: SpacetimeData }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Calendar}
        label="SpaceTime — Agendamentos"
        color="text-blue-600"
        bg="bg-blue-50 dark:bg-blue-950/40"
        description="Reuniões e compromissos agendados no período"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de agendamentos" value={fmt(data.total)}
          icon={Calendar} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Realizados" value={fmt(data.done)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={`${data.conversionRate.toFixed(0)}%`} badgeVariant="default" />
        <KpiCard label="Confirmados" value={fmt(data.confirmed)}
          icon={CheckCircle2} color="text-indigo-500" bg="bg-indigo-50 dark:bg-indigo-950/40" />
        <KpiCard label="Pendentes" value={fmt(data.pending)}
          icon={Clock} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40" />
        <KpiCard label="Cancelados" value={fmt(data.cancelled)}
          icon={XCircle} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40" />
        <KpiCard label="No-show" value={fmt(data.noShow)}
          icon={AlertCircle} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-950/40"
          sub="Não compareceu" />
        <KpiCard label="Com lead vinculado" value={fmt(data.withLead)}
          icon={Users} color="text-violet-500" bg="bg-violet-50 dark:bg-violet-950/40"
          sub="Agendamentos rastreáveis" />
      </div>
    </div>
  );
}

// ─── NASA Post Section ───────────────────────────────────────────────────────

interface NasaPostData {
  total: number;
  draft: number;
  published: number;
  scheduled: number;
  approved: number;
  starsSpent: number;
  byNetwork: Record<string, number>;
}

const NETWORK_LABELS: Record<string, { label: string; icon: React.FC<{ className?: string }> }> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook:  { label: "Facebook",  icon: Facebook },
  twitter:   { label: "Twitter/X", icon: Twitter },
  linkedin:  { label: "LinkedIn",  icon: MessageSquare },
  tiktok:    { label: "TikTok",    icon: MessageSquare },
};

export function NasaPostSection({ data }: { data: NasaPostData }) {
  const networks = Object.entries(data.byNetwork).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Sparkles}
        label="NASA Post — Conteúdo"
        color="text-pink-600"
        bg="bg-pink-50 dark:bg-pink-950/40"
        description="Posts criados e publicados no período"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Posts criados" value={fmt(data.total)}
          icon={Sparkles} color="text-pink-600" bg="bg-pink-50 dark:bg-pink-950/40" />
        <KpiCard label="Publicados" value={fmt(data.published)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={data.total > 0 ? `${((data.published / data.total) * 100).toFixed(0)}%` : "0%"}
          badgeVariant="default" />
        <KpiCard label="Agendados" value={fmt(data.scheduled)}
          icon={Clock} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Rascunhos" value={fmt(data.draft)}
          icon={FileText} color="text-zinc-500" bg="bg-zinc-100 dark:bg-zinc-800" />
        <KpiCard label="Stars gastos" value={fmt(data.starsSpent)}
          icon={Sparkles} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40"
          sub="Créditos consumidos na geração IA" />
      </div>

      {networks.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Posts por rede social</p>
          <div className="flex flex-wrap gap-2">
            {networks.map(([net, count]) => {
              const def = NETWORK_LABELS[net.toLowerCase()];
              const Icon = def?.icon ?? Sparkles;
              return (
                <div key={net} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-xs font-medium">
                  <Icon className="size-3.5 text-muted-foreground" />
                  {def?.label ?? net}: <span className="font-bold ml-1">{fmt(count)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Integrations (Meta Ads summary) ─────────────────────────────────────────

export function IntegrationsSection({ metaAds }: {
  metaAds?: {
    connected: boolean;
    data?: {
      spend: number; impressions: number; clicks: number;
      ctr: number; cpl: number; leads: number; roas: number;
      conversions: number; conversionRate: number;
    } | null;
  };
}) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Plug}
        label="Integrações — Meta Ads"
        color="text-[#0082FB]"
        bg="bg-blue-50 dark:bg-blue-950/40"
        description="Métricas de campanhas conectadas via Meta Marketing API"
      />
      {!metaAds?.connected || !metaAds?.data ? (
        <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
            <Plug className="size-5 text-blue-500" />
          </div>
          <p className="text-sm font-medium">Meta Ads não conectado</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Configure o Token de Acesso e Ad Account ID em{" "}
            <a href="/integrations" className="text-primary hover:underline">Integrações → Meta Ads</a>{" "}
            para visualizar métricas de campanhas aqui.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <KpiCard label="Investimento" value={fmtBRL(metaAds.data.spend)}
            icon={DollarSign} color="text-[#0082FB]" bg="bg-blue-50 dark:bg-blue-950/40" />
          <KpiCard label="ROAS" value={`${metaAds.data.roas.toFixed(2)}x`}
            icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
            badge={metaAds.data.roas > 2 ? "Bom" : "Atenção"}
            badgeVariant={metaAds.data.roas > 2 ? "default" : "secondary"} />
          <KpiCard label="Leads gerados" value={fmt(metaAds.data.leads)}
            icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
            sub={`CPL ${fmtBRL(metaAds.data.cpl)}`} />
          <KpiCard label="Cliques" value={fmt(metaAds.data.clicks)}
            icon={TrendingUp} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40"
            sub={`CTR ${metaAds.data.ctr.toFixed(2)}%`} />
          <KpiCard label="Impressões" value={fmt(metaAds.data.impressions)}
            icon={MessageSquare} color="text-indigo-500" bg="bg-indigo-50 dark:bg-indigo-950/40" />
          <KpiCard label="Conversões" value={fmt(metaAds.data.conversions)}
            icon={CheckCircle2} color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-950/40"
            sub={`Taxa ${metaAds.data.conversionRate.toFixed(1)}%`} />
        </div>
      )}
    </div>
  );
}
