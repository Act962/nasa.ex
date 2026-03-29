"use client";

import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Users,
  Flame,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { AppModule } from "./app-selector";

interface CrossDataProps {
  selectedModules: AppModule[];
  tracking?: {
    totalLeads: number;
    wonLeads: number;
    conversionRate: number;
    activeLeads: number;
  };
  chat?: {
    totalConversations: number;
    totalMessages: number;
    attendedConversations: number;
    attendanceRate: number;
  };
  forge?: {
    totalProposals: number;
    pagas: number;
    revenueTotal: number;
    revenuePipeline: number;
  };
  spacetime?: {
    total: number;
    done: number;
    conversionRate: number;
  };
  nasaPost?: {
    total: number;
    published: number;
  };
  metaAds?: {
    spend?: number;
    roas?: number;
    leads?: number;
    cpl?: number;
  };
}

interface CrossCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  trend?: "up" | "down" | "neutral";
  alert?: string;
}

function CrossCard({ label, value, sub, icon: Icon, color, bg, trend, alert }: CrossCardProps) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-2 bg-card relative overflow-hidden")}>
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
        <Icon className={cn("size-4", color)} />
      </div>
      <div>
        <p className="text-2xl font-bold leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
      </div>
      {trend === "up" && <TrendingUp className="absolute top-3 right-3 size-4 text-emerald-500" />}
      {trend === "down" && <TrendingDown className="absolute top-3 right-3 size-4 text-red-400" />}
      {alert && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-2 py-1 mt-1">
          <AlertCircle className="size-3 shrink-0" />
          {alert}
        </div>
      )}
    </div>
  );
}

function fmt(n: number) { return n.toLocaleString("pt-BR"); }
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}
function fmtPct(n: number) { return `${n.toFixed(1)}%`; }

export function CrossDataOverview({ selectedModules, tracking, chat, forge, spacetime, nasaPost, metaAds }: CrossDataProps) {
  const cards: CrossCardProps[] = [];

  // ── Tracking cards ────────────────────────────────────────────────────────
  if (selectedModules.includes("tracking") && tracking) {
    cards.push({
      label: "Leads ativos",
      value: fmt(tracking.activeLeads),
      sub: `${fmt(tracking.wonLeads)} ganhos · ${fmtPct(tracking.conversionRate)} conversão`,
      icon: Users,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      trend: tracking.conversionRate > 20 ? "up" : "neutral",
    });
  }

  // ── Chat cards ────────────────────────────────────────────────────────────
  if (selectedModules.includes("chat") && chat) {
    const unattended = chat.totalConversations - chat.attendedConversations;
    cards.push({
      label: "Mensagens recebidas",
      value: fmt(chat.totalMessages),
      sub: `${fmt(chat.totalConversations)} conversas · ${fmtPct(chat.attendanceRate)} atendidas`,
      icon: MessageSquare,
      color: "text-violet-600",
      bg: "bg-violet-50 dark:bg-violet-950/40",
      trend: chat.attendanceRate > 80 ? "up" : chat.attendanceRate < 50 ? "down" : "neutral",
      alert:
        unattended > 0
          ? `${fmt(unattended)} conversas sem atendente`
          : undefined,
    });
  }

  // ── Forge cards ───────────────────────────────────────────────────────────
  if (selectedModules.includes("forge") && forge) {
    cards.push({
      label: "Receita fechada",
      value: fmtBRL(forge.revenueTotal),
      sub: `${fmtBRL(forge.revenuePipeline)} em pipeline · ${forge.pagas} propostas pagas`,
      icon: Flame,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      trend: forge.pagas > 0 ? "up" : "neutral",
    });
  }

  // ── SpaceTime cards ───────────────────────────────────────────────────────
  if (selectedModules.includes("spacetime") && spacetime) {
    cards.push({
      label: "Agendamentos realizados",
      value: fmt(spacetime.done),
      sub: `${fmt(spacetime.total)} totais · ${fmtPct(spacetime.conversionRate)} taxa de realização`,
      icon: Calendar,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      trend: spacetime.conversionRate > 70 ? "up" : "neutral",
    });
  }

  // ── NASA Post cards ───────────────────────────────────────────────────────
  if (selectedModules.includes("nasa-post") && nasaPost) {
    cards.push({
      label: "Posts publicados",
      value: fmt(nasaPost.published),
      sub: `${fmt(nasaPost.total)} criados no período`,
      icon: Sparkles,
      color: "text-pink-600",
      bg: "bg-pink-50 dark:bg-pink-950/40",
    });
  }

  // ── Meta Ads cards ────────────────────────────────────────────────────────
  if (selectedModules.includes("integrations") && metaAds?.spend !== undefined) {
    cards.push({
      label: "Investimento Meta Ads",
      value: fmtBRL(metaAds.spend ?? 0),
      sub: metaAds.roas
        ? `ROAS ${metaAds.roas.toFixed(2)}x · CPL ${fmtBRL(metaAds.cpl ?? 0)}`
        : "Meta Ads conectado",
      icon: TrendingUp,
      color: "text-[#0082FB]",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      trend: (metaAds.roas ?? 0) > 2 ? "up" : "neutral",
    });
  }

  // ── Cross insights (only when ≥2 modules) ─────────────────────────────────
  const crossInsights: React.ReactNode[] = [];

  if (
    selectedModules.includes("integrations") &&
    selectedModules.includes("chat") &&
    chat &&
    metaAds
  ) {
    const attended = chat.attendedConversations;
    const totalMsgs = chat.totalMessages;
    const unattended = totalMsgs - attended;
    if (unattended > 0) {
      crossInsights.push(
        <div
          key="meta-chat"
          className="flex items-start gap-2.5 p-3 rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
        >
          <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Oportunidade: {fmt(unattended)} mensagens não atendidas durante o período de anúncios
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
              O investimento em Meta Ads trouxe tráfego mas o atendimento ficou em{" "}
              {fmtPct(chat.attendanceRate)}. Aumente a equipe ou ative o assistente de chatbot.
            </p>
          </div>
        </div>,
      );
    }
  }

  if (
    selectedModules.includes("tracking") &&
    selectedModules.includes("forge") &&
    tracking &&
    forge
  ) {
    const leadsWithProposal = forge.totalProposals;
    const convRate = tracking.totalLeads > 0
      ? (forge.pagas / tracking.totalLeads) * 100
      : 0;
    crossInsights.push(
      <div
        key="tracking-forge"
        className="flex items-start gap-2.5 p-3 rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900"
      >
        <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            {fmtPct(convRate)} dos leads resultaram em proposta paga
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
            {fmt(leadsWithProposal)} propostas geradas · {fmt(forge.pagas)} pagas ·{" "}
            {fmtBRL(forge.revenueTotal)} em receita fechada
          </p>
        </div>
      </div>,
    );
  }

  if (cards.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Visão Geral Cruzada</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Métricas consolidadas dos apps selecionados no período
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <CrossCard key={c.label} {...c} />
        ))}
      </div>

      {crossInsights.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            💡 Insights cruzados
          </p>
          {crossInsights}
        </div>
      )}
    </div>
  );
}
