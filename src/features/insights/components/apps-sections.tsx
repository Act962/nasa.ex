"use client";

import { cn } from "@/lib/utils";
import {
  Flame, Calendar, Sparkles, Plug,
  FileText, CheckCircle2, XCircle, Clock,
  DollarSign, Instagram, Twitter, Facebook,
  MessageSquare, Users, TrendingUp, AlertCircle,
  ListTodo, FormInput, Inbox, Wallet, Link2, Coins, Star,
  Activity, Eye, Award, ShoppingCart, Receipt,
  Rocket, Map as MapIcon, GraduationCap, BookOpen,
} from "lucide-react";
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

interface NasaPlannerData {
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

export function NasaPlannerSection({ data }: { data: NasaPlannerData }) {
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

// ─── Workspace Section ───────────────────────────────────────────────────────

interface WorkspaceData {
  total: number;
  done: number;
  open: number;
  overdue: number;
  byType: Record<string, number>;
  topCreators: Array<{
    id: string;
    name: string;
    image: string | null;
    count: number;
  }>;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  TASK: "Tarefas",
  EVENT: "Eventos",
  MEETING: "Reuniões",
  CALL: "Ligações",
  EMAIL: "E-mails",
  NOTE: "Notas",
  DEADLINE: "Prazos",
};

export function WorkspaceSection({ data }: { data: WorkspaceData }) {
  const types = Object.entries(data.byType).sort((a, b) => b[1] - a[1]);
  const completionRate = data.total > 0 ? (data.done / data.total) * 100 : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={ListTodo}
        label="Workspace — Ações"
        color="text-amber-600"
        bg="bg-amber-50 dark:bg-amber-950/40"
        description="Tarefas, eventos e ações criadas no período"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de ações" value={fmt(data.total)}
          icon={ListTodo} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/40" />
        <KpiCard label="Concluídas" value={fmt(data.done)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={`${completionRate.toFixed(0)}%`} badgeVariant="default" />
        <KpiCard label="Em aberto" value={fmt(data.open)}
          icon={Clock} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Atrasadas" value={fmt(data.overdue)}
          icon={AlertCircle} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40"
          sub="Vencidas e não concluídas" />
      </div>

      {types.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Por tipo</p>
          <div className="flex flex-wrap gap-2">
            {types.map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-xs font-medium">
                {ACTION_TYPE_LABELS[type] ?? type}: <span className="font-bold ml-1">{fmt(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.topCreators.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top criadores</p>
          <div className="space-y-2">
            {data.topCreators.map((u, i) => (
              <div key={u.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                  <div className="w-6 h-6 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-[10px] font-bold text-amber-600 shrink-0 overflow-hidden">
                    {u.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.image} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      u.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <p className="text-sm truncate">{u.name}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{fmt(u.count)} ações</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Forms Section ───────────────────────────────────────────────────────────

interface FormsData {
  totalForms: number;
  publishedForms: number;
  totalResponses: number;
  responsesWithLead: number;
  totalViews: number;
  topForms: Array<{ id: string; name: string; responses: number }>;
}

export function FormsSection({ data }: { data: FormsData }) {
  const conversionRate = data.totalViews > 0 ? (data.totalResponses / data.totalViews) * 100 : 0;
  const leadRate = data.totalResponses > 0 ? (data.responsesWithLead / data.totalResponses) * 100 : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={FormInput}
        label="Formulários"
        color="text-teal-600"
        bg="bg-teal-50 dark:bg-teal-950/40"
        description="Formulários publicados e respostas captadas"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Formulários" value={fmt(data.totalForms)}
          icon={FormInput} color="text-teal-600" bg="bg-teal-50 dark:bg-teal-950/40"
          sub={`${data.publishedForms} publicados`} />
        <KpiCard label="Respostas" value={fmt(data.totalResponses)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={`${conversionRate.toFixed(0)}%`} badgeVariant="default"
          sub="Taxa de conversão" />
        <KpiCard label="Visualizações" value={fmt(data.totalViews)}
          icon={Eye} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Geraram lead" value={fmt(data.responsesWithLead)}
          icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
          sub={`${leadRate.toFixed(0)}% das respostas`} />
      </div>

      {data.topForms.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top formulários por respostas</p>
          <div className="space-y-2">
            {data.topForms.map((f, i) => (
              <div key={f.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                  <p className="text-sm truncate">{f.name}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{fmt(f.responses)} respostas</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── N-Box Section ───────────────────────────────────────────────────────────

interface NBoxData {
  totalItems: number;
  publicItems: number;
  totalSize: number;
  byType: Record<string, number>;
}

const NBOX_TYPE_LABELS: Record<string, string> = {
  FILE: "Arquivos",
  FOLDER: "Pastas",
  LINK: "Links",
  NOTE: "Notas",
  IMAGE: "Imagens",
  VIDEO: "Vídeos",
};

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function NBoxSection({ data }: { data: NBoxData }) {
  const types = Object.entries(data.byType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Inbox}
        label="N-Box — Arquivos"
        color="text-slate-600"
        bg="bg-slate-50 dark:bg-slate-950/40"
        description="Itens armazenados no N-Box"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Total de itens" value={fmt(data.totalItems)}
          icon={Inbox} color="text-slate-600" bg="bg-slate-50 dark:bg-slate-950/40" />
        <KpiCard label="Públicos" value={fmt(data.publicItems)}
          icon={Eye} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Espaço usado" value={fmtSize(data.totalSize)}
          icon={Activity} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
          sub="Soma do tamanho dos arquivos" />
      </div>

      {types.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Por tipo</p>
          <div className="flex flex-wrap gap-2">
            {types.map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border bg-muted/40 text-xs font-medium">
                {NBOX_TYPE_LABELS[type] ?? type}: <span className="font-bold ml-1">{fmt(count)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payment Section ─────────────────────────────────────────────────────────

interface PaymentData {
  totalEntries: number;
  revenue: number;
  expense: number;
  pendingCount: number;
  pendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
  avgTicket: number;
}

export function PaymentSection({ data }: { data: PaymentData }) {
  const profit = data.revenue - data.expense;
  const margin = data.revenue > 0 ? (profit / data.revenue) * 100 : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Wallet}
        label="Pagamentos — Hub Financeiro"
        color="text-green-600"
        bg="bg-green-50 dark:bg-green-950/40"
        description="Fluxo financeiro: receitas, despesas e pendências"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita realizada" value={fmtBRL(data.revenue)}
          icon={TrendingUp} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          sub="Recebimentos pagos" />
        <KpiCard label="Despesa realizada" value={fmtBRL(data.expense)}
          icon={ShoppingCart} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40"
          sub="Pagamentos efetuados" />
        <KpiCard label="Resultado líquido" value={fmtBRL(profit)}
          icon={DollarSign}
          color={profit >= 0 ? "text-emerald-600" : "text-red-500"}
          bg={profit >= 0 ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-red-50 dark:bg-red-950/40"}
          badge={`${margin.toFixed(0)}%`}
          badgeVariant={profit >= 0 ? "default" : "destructive"}
          sub="Margem do período" />
        <KpiCard label="Ticket médio" value={fmtBRL(data.avgTicket)}
          icon={Receipt} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/40"
          sub="Por entrada paga" />
        <KpiCard label="A receber/pagar" value={fmt(data.pendingCount)}
          icon={Clock} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40"
          sub={fmtBRL(data.pendingAmount)} />
        <KpiCard label="Em atraso" value={fmt(data.overdueCount)}
          icon={AlertCircle} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40"
          sub={fmtBRL(data.overdueAmount)}
          badge={data.overdueCount > 0 ? "Atenção" : undefined}
          badgeVariant="destructive" />
        <KpiCard label="Total de lançamentos" value={fmt(data.totalEntries)}
          icon={FileText} color="text-zinc-500" bg="bg-zinc-100 dark:bg-zinc-800" />
      </div>
    </div>
  );
}

// ─── Linnker Section ─────────────────────────────────────────────────────────

interface LinnkerData {
  totalScans: number;
  scansWithLead: number;
  totalClicks: number;
  topLinks: Array<{ id: string; title: string; clicks: number }>;
}

export function LinnkerSection({ data }: { data: LinnkerData }) {
  const captureRate = data.totalScans > 0 ? (data.scansWithLead / data.totalScans) * 100 : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Link2}
        label="Linnker — Páginas & QR"
        color="text-purple-600"
        bg="bg-purple-50 dark:bg-purple-950/40"
        description="Acessos a páginas e cliques em links"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Acessos" value={fmt(data.totalScans)}
          icon={Activity} color="text-purple-600" bg="bg-purple-50 dark:bg-purple-950/40" />
        <KpiCard label="Capturaram lead" value={fmt(data.scansWithLead)}
          icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
          badge={`${captureRate.toFixed(0)}%`} badgeVariant="default" />
        <KpiCard label="Total de cliques" value={fmt(data.totalClicks)}
          icon={TrendingUp} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40"
          sub="Em links ativos" />
      </div>

      {data.topLinks.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top links por cliques</p>
          <div className="space-y-2">
            {data.topLinks.map((l, i) => (
              <div key={l.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                  <p className="text-sm truncate">{l.title}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{fmt(l.clicks)} cliques</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Space Points Section ────────────────────────────────────────────────────

interface SpacePointsData {
  totalBalance: number;
  weeklyBalance: number;
  granted: number;
  spent: number;
  activeUsers: number;
  totalUsers: number;
}

export function SpacePointsSection({ data }: { data: SpacePointsData }) {
  const engagementRate = data.totalUsers > 0 ? (data.activeUsers / data.totalUsers) * 100 : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Coins}
        label="Space Points — Gamificação"
        color="text-yellow-600"
        bg="bg-yellow-50 dark:bg-yellow-950/40"
        description="Pontos distribuídos e consumidos pela equipe"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Saldo total" value={fmt(data.totalBalance)}
          icon={Coins} color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-950/40"
          sub="SP acumulados pelos usuários" />
        <KpiCard label="Saldo semanal" value={fmt(data.weeklyBalance)}
          icon={Activity} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-950/40" />
        <KpiCard label="SP distribuídos" value={fmt(data.granted)}
          icon={Award} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          sub="Ganhos no período" />
        <KpiCard label="SP gastos" value={fmt(data.spent)}
          icon={ShoppingCart} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40"
          sub="Resgates no período" />
        <KpiCard label="Usuários ativos" value={fmt(data.activeUsers)}
          icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
          badge={`${engagementRate.toFixed(0)}%`} badgeVariant="default"
          sub={`${data.totalUsers} total`} />
      </div>
    </div>
  );
}

// ─── Stars Section ───────────────────────────────────────────────────────────

interface StarsData {
  lastBalance: number;
  topupTotal: number;
  appCharges: number;
  planCredit: number;
  byApp: Record<string, number>;
}

export function StarsSection({ data }: { data: StarsData }) {
  const apps = Object.entries(data.byApp).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Star}
        label="Stars — Créditos de IA"
        color="text-fuchsia-600"
        bg="bg-fuchsia-50 dark:bg-fuchsia-950/40"
        description="Consumo de créditos para apps com IA"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Saldo atual" value={fmt(data.lastBalance)}
          icon={Star} color="text-fuchsia-600" bg="bg-fuchsia-50 dark:bg-fuchsia-950/40"
          sub="Stars disponíveis" />
        <KpiCard label="Comprados" value={fmt(data.topupTotal)}
          icon={ShoppingCart} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          sub="Recargas no período" />
        <KpiCard label="Crédito do plano" value={fmt(data.planCredit)}
          icon={Award} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40"
          sub="Mensalidade" />
        <KpiCard label="Consumidos" value={fmt(data.appCharges)}
          icon={Activity} color="text-red-500" bg="bg-red-50 dark:bg-red-950/40"
          sub="Gastos por apps no período" />
      </div>

      {apps.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top apps por consumo</p>
          <div className="space-y-2">
            {apps.map(([app, amount], i) => (
              <div key={app} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                  <p className="text-sm truncate capitalize">{app.replace(/-/g, " ")}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{fmt(amount)} ⭐</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Space Station Section ───────────────────────────────────────────────────

interface SpaceStationData {
  totalStations: number;
  publicStations: number;
  orgStations: number;
  userStations: number;
  totalStarsReceived: number;
  starsSentInPeriod: number;
  starsReceivedInPeriod: number;
  pendingAccessRequests: number;
  approvedAccessRequests: number;
}

export function SpaceStationSection({ data }: { data: SpaceStationData }) {
  return (
    <div className="space-y-3">
      <SectionHeader
        icon={Rocket}
        label="Space Station — Mundos & Comunidade"
        color="text-indigo-600"
        bg="bg-indigo-50 dark:bg-indigo-950/40"
        description="Estações, mundos públicos e engajamento com Stars"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Estações" value={fmt(data.totalStations)}
          icon={Rocket} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-950/40"
          sub={`${data.orgStations} org · ${data.userStations} pessoais`} />
        <KpiCard label="Públicas" value={fmt(data.publicStations)}
          icon={Eye} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40"
          sub="Visíveis em /space" />
        <KpiCard label="Stars enviados" value={fmt(data.starsSentInPeriod)}
          icon={Star} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40"
          sub="No período" />
        <KpiCard label="Stars recebidos" value={fmt(data.starsReceivedInPeriod)}
          icon={Star} color="text-fuchsia-600" bg="bg-fuchsia-50 dark:bg-fuchsia-950/40"
          sub={`${fmt(data.totalStarsReceived)} total`} />
        <KpiCard label="Pedidos de acesso" value={fmt(data.pendingAccessRequests)}
          icon={Clock} color="text-orange-500" bg="bg-orange-50 dark:bg-orange-950/40"
          sub="Pendentes"
          badge={data.pendingAccessRequests > 0 ? "Atenção" : undefined}
          badgeVariant="secondary" />
        <KpiCard label="Acessos aprovados" value={fmt(data.approvedAccessRequests)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          sub="No período" />
      </div>
    </div>
  );
}

// ─── NASA Route Section ──────────────────────────────────────────────────────

interface NasaRouteData {
  totalCourses: number;
  publishedCourses: number;
  totalStudents: number;
  totalEnrollments: number;
  paidEnrollments: number;
  freeEnrollments: number;
  starsRevenue: number;
  completedCourses: number;
  completedLessons: number;
  certificatesIssued: number;
  topCourses: Array<{ id: string; title: string; enrollments: number }>;
}

export function NasaRouteSection({ data }: { data: NasaRouteData }) {
  const completionRate = data.totalEnrollments > 0
    ? (data.completedCourses / data.totalEnrollments) * 100
    : 0;

  return (
    <div className="space-y-3">
      <SectionHeader
        icon={MapIcon}
        label="NASA Route — Cursos & Trilhas"
        color="text-sky-600"
        bg="bg-sky-50 dark:bg-sky-950/40"
        description="Cursos publicados, alunos e progresso"
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard label="Cursos" value={fmt(data.totalCourses)}
          icon={BookOpen} color="text-sky-600" bg="bg-sky-50 dark:bg-sky-950/40"
          sub={`${data.publishedCourses} publicados`} />
        <KpiCard label="Alunos" value={fmt(data.totalStudents)}
          icon={Users} color="text-violet-600" bg="bg-violet-50 dark:bg-violet-950/40"
          sub="Total de matrículas únicas" />
        <KpiCard label="Matrículas" value={fmt(data.totalEnrollments)}
          icon={GraduationCap} color="text-blue-500" bg="bg-blue-50 dark:bg-blue-950/40"
          sub={`${data.paidEnrollments} pagas · ${data.freeEnrollments} livres`} />
        <KpiCard label="Receita em Stars" value={fmt(data.starsRevenue)}
          icon={Star} color="text-fuchsia-600" bg="bg-fuchsia-50 dark:bg-fuchsia-950/40"
          sub="Stars arrecadados" />
        <KpiCard label="Cursos concluídos" value={fmt(data.completedCourses)}
          icon={CheckCircle2} color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-950/40"
          badge={`${completionRate.toFixed(0)}%`} badgeVariant="default"
          sub="Taxa de conclusão" />
        <KpiCard label="Aulas assistidas" value={fmt(data.completedLessons)}
          icon={Activity} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KpiCard label="Certificados" value={fmt(data.certificatesIssued)}
          icon={Award} color="text-amber-500" bg="bg-amber-50 dark:bg-amber-950/40"
          sub="Emitidos no período" />
      </div>

      {data.topCourses.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Top cursos por matrículas</p>
          <div className="space-y-2">
            {data.topCourses.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                  <p className="text-sm truncate">{c.title}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{fmt(c.enrollments)} matrículas</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
