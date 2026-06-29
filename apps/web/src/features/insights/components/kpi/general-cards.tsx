"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Trophy,
  XCircle,
  Percent,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/features/insights/types";
import { cn } from "@/lib/utils";
import {
  LeadsByMetricDialog,
  type LeadMetricKey,
} from "@/features/insights/components/leads-by-metric-dialog";

interface KPICardsProps {
  summary: DashboardSummary;
}

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number | null;
  trendLabel?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  onClick?: () => void;
}

function KPICard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  variant = "default",
  onClick,
}: KPICardProps) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-success/10 border-success/20",
    warning: "bg-warning/10 border-warning/20",
    destructive: "bg-destructive/10 border-destructive/20",
  };

  const iconStyles = {
    default: "bg-muted-foreground/10 text-muted-foreground",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/20 text-destructive",
  };

  return (
    <Card
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "transition-all hover:shadow-md",
        variantStyles[variant],
        onClick && "cursor-pointer hover:border-primary",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("rounded-lg p-2", iconStyles[variant])}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && trend !== null && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span
              className={cn(
                "font-medium",
                trend >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {trend >= 0 ? "+" : ""}
              {trend}%
            </span>
            {trendLabel && (
              <span className="text-muted-foreground">{trendLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KPIGeneralCards({ summary }: KPICardsProps) {
  // Estado do popup — só uma métrica de cada vez. Os cards de valor
  // monetário e taxa de conversão também abrem o popup (apontando pra
  // métrica de lead correspondente: active, won...). Crescimento Mensal
  // é meta-métrica → sem popup.
  const [leadMetric, setLeadMetric] = useState<{
    key: LeadMetricKey;
    label: string;
  } | null>(null);

  const open = (key: LeadMetricKey, label: string) =>
    setLeadMetric({ key, label });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total de Leads"
        value={summary.totalLeads.toLocaleString("pt-BR")}
        icon={<Users className="size-4" />}
        onClick={() => open("lead.total", "Total de Leads")}
      />
      <KPICard
        title="Leads Ativos"
        value={summary.activeLeads.toLocaleString("pt-BR")}
        icon={<Target className="size-4" />}
        variant="warning"
        onClick={() => open("lead.active", "Leads Ativos")}
      />
      <KPICard
        title="Leads Ganhos"
        value={summary.wonLeads.toLocaleString("pt-BR")}
        icon={<Trophy className="size-4" />}
        variant="success"
        onClick={() => open("lead.won", "Leads Ganhos")}
      />
      <KPICard
        title="Leads Perdidos"
        value={summary.lostLeads.toLocaleString("pt-BR")}
        icon={<XCircle className="size-4" />}
        variant="destructive"
        onClick={() => open("lead.lost", "Leads Perdidos")}
      />
      <KPICard
        title="Taxa de Conversão"
        value={`${summary.conversionRate}%`}
        icon={<Percent className="size-4" />}
        variant="success"
        onClick={() => open("lead.won", "Leads Ganhos (Conversão)")}
      />
      <KPICard
        title="Valor de leads Ativos"
        value={summary.soldActiveRes.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
        icon={<CalendarDays className="size-4" />}
        trend={summary.monthGrowthRate}
        trendLabel="vs mês anterior"
        onClick={() => open("lead.active", "Leads Ativos")}
      />
      <KPICard
        title="Valor de leads ganhos"
        value={summary.soldWinnerRes.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
        icon={<CalendarDays className="size-4" />}
        onClick={() => open("lead.won", "Leads Ganhos")}
      />
      <KPICard
        title="Crescimento Mensal"
        value={
          summary.monthGrowthRate !== null
            ? `${summary.monthGrowthRate >= 0 ? "+" : ""}${summary.monthGrowthRate}%`
            : "N/A"
        }
        icon={
          summary.monthGrowthRate !== null && summary.monthGrowthRate >= 0 ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )
        }
        variant={
          summary.monthGrowthRate !== null && summary.monthGrowthRate >= 0
            ? "success"
            : "destructive"
        }
      />
      {leadMetric && (
        <LeadsByMetricDialog
          open={!!leadMetric}
          onOpenChange={(o) => !o && setLeadMetric(null)}
          app="lead"
          metric={leadMetric.key}
          title={leadMetric.label}
        />
      )}
    </div>
  );
}
