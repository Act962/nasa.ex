"use client";

import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Cartões de "Cruzamentos" do Insights: seguem os filtros do menu (o Gráfico Cruzado não). */

export interface CrossInsightTilesProps {
  tracking?: { totalLeads: number; wonLeads: number; activeLeads: number; conversionRate?: number };
  chat?: {
    totalConversations: number; totalMessages: number;
    attendedConversations: number; unattendedConversations: number; attendanceRate?: number;
  };
  forge?: {
    totalProposals: number; rascunho: number; enviadas: number; visualizadas: number;
    pagas: number; expiradas: number; canceladas: number;
    revenueTotal: number; revenuePipeline: number;
    /** Leads distintos com proposta paga (ForgeProposal.clientId). */
    leadsWithPaidProposal?: number;
  };
  spacetime?: {
    total: number; pending: number; confirmed: number;
    done: number; cancelled: number; noShow: number; conversionRate?: number;
  };
  nasaPlanner?: { total: number; draft: number; published: number; scheduled: number };
  metaAds?: { spend?: number; roas?: number; leads?: number; clicks?: number; impressions?: number; cpl?: number };
}

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

export function CrossInsightTiles({ tracking, chat, forge, spacetime, metaAds }: CrossInsightTilesProps) {
  const tiles: InsightTile[] = [];

  // Tracking → Forge
  if (tracking && forge) {
    // Conta leads (não propostas): um lead com duas propostas pagas entra uma vez só.
    const leadsWithPaidProposal = forge.leadsWithPaidProposal ?? 0;
    const pct = tracking.totalLeads > 0
      ? (leadsWithPaidProposal / tracking.totalLeads) * 100
      : 0;
    tiles.push({
      key: "leads-forge",
      icon: CheckCircle2,
      iconColor: "text-success",
      iconBg: "bg-success/10 dark:bg-success/15",
      borderColor: "border-success/30 dark:border-success/40",
      bgColor: "bg-success/10 dark:bg-success/15",
      title: `${fmtPct(pct)} dos leads resultaram em proposta paga`,
      subtitle: `${fmt(leadsWithPaidProposal)} de ${fmt(tracking.totalLeads)} leads · ${fmt(forge.pagas)} propostas pagas · ${fmtBRL(forge.revenueTotal)} em receita fechada`,
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
      iconColor: unattended > 0 ? "text-warning" : "text-success",
      iconBg: unattended > 0 ? "bg-warning/10 dark:bg-warning/15" : "bg-success/10 dark:bg-success/15",
      borderColor: unattended > 0 ? "border-warning/30 dark:border-warning/40" : "border-success/30 dark:border-success/40",
      bgColor: unattended > 0 ? "bg-warning/10 dark:bg-warning/15" : "bg-success/10 dark:bg-success/15",
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
      iconColor: "text-info",
      iconBg: "bg-info/10 dark:bg-info/15",
      borderColor: "border-info/30 dark:border-info/40",
      bgColor: "bg-info/10 dark:bg-info/15",
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
        iconColor: "text-warning",
        iconBg: "bg-warning/10 dark:bg-warning/15",
        borderColor: "border-warning/30 dark:border-warning/40",
        bgColor: "bg-warning/10 dark:bg-warning/15",
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
      iconColor: (metaAds.roas ?? 0) > 2 ? "text-success" : "text-warning",
      iconBg: (metaAds.roas ?? 0) > 2 ? "bg-success/10 dark:bg-success/15" : "bg-warning/10 dark:bg-warning/15",
      borderColor: (metaAds.roas ?? 0) > 2 ? "border-success/30 dark:border-success/40" : "border-warning/30 dark:border-warning/40",
      bgColor: (metaAds.roas ?? 0) > 2 ? "bg-success/10 dark:bg-success/15" : "bg-warning/10 dark:bg-warning/15",
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
