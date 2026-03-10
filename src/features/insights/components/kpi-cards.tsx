"use client";

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
}

function KPICard({
  title,
  value,
  icon,
  trend,
  trendLabel,
  variant = "default",
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
      className={cn("transition-all hover:shadow-md", variantStyles[variant])}
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

export function KPICards({ summary }: KPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total de Leads"
        value={summary.totalLeads.toLocaleString("pt-BR")}
        icon={<Users className="size-4" />}
      />
      <KPICard
        title="Leads Ativos"
        value={summary.activeLeads.toLocaleString("pt-BR")}
        icon={<Target className="size-4" />}
        variant="warning"
      />
      <KPICard
        title="Leads Ganhos"
        value={summary.wonLeads.toLocaleString("pt-BR")}
        icon={<Trophy className="size-4" />}
        variant="success"
      />
      <KPICard
        title="Leads Perdidos"
        value={summary.lostLeads.toLocaleString("pt-BR")}
        icon={<XCircle className="size-4" />}
        variant="destructive"
      />
      <KPICard
        title="Taxa de Conversão"
        value={`${summary.conversionRate}%`}
        icon={<Percent className="size-4" />}
        variant="success"
      />
      <KPICard
        title="Vendas Este Mês"
        value={summary.soldThisMonth.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
        icon={<CalendarDays className="size-4" />}
        trend={summary.monthGrowthRate}
        trendLabel="vs mês anterior"
      />
      <KPICard
        title="Vendas Mês Passado"
        value={summary.soldLastMonth.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}
        icon={<CalendarDays className="size-4" />}
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
    </div>
  );
}
