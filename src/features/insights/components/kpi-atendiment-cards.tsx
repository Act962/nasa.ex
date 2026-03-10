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
  MessageSquare,
  MessageCircle,
  Send,
  Download,
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

export function KPIAtendimentCards({ summary }: KPICardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPICard
        title="Total de Conversas"
        value={summary.totalConversations.toLocaleString("pt-BR")}
        icon={<MessageSquare className="size-4" />}
      />
      <KPICard
        title="Total de Mensagens"
        value={summary.totalMessages.toLocaleString("pt-BR")}
        icon={<MessageCircle className="size-4" />}
      />
      <KPICard
        title="Mensagens Enviadas"
        value={summary.sentMessages.toLocaleString("pt-BR")}
        icon={<Send className="size-4" />}
        variant="success"
      />
      <KPICard
        title="Mensagens Recebidas"
        value={summary.receivedMessages.toLocaleString("pt-BR")}
        icon={<Download className="size-4" />}
        variant="warning"
      />
    </div>
  );
}
