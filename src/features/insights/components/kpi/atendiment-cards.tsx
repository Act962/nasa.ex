"use client";

import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  MessageCircle,
  Send,
  Download,
  Clock,
  Activity,
  BellRing,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/features/insights/types";
import { cn } from "@/lib/utils";

interface KPICardsProps {
  summary: DashboardSummary;
  onSentRemindersClick?: () => void;
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

function formatTTFR(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "N/A";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function KPIAtendimentCards({
  summary,
  onSentRemindersClick,
}: KPICardsProps) {
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
        title="Aguardando atendimento"
        value={summary.leadsWaiting.toLocaleString("pt-BR")}
        icon={<Clock className="size-4" />}
        variant="warning"
      />
      <KPICard
        title="Em atendimento"
        value={summary.leadsActive.toLocaleString("pt-BR")}
        icon={<Activity className="size-4" />}
        variant="success"
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
      <KPICard
        title="Tempo Médio de 1ª Resposta"
        value={formatTTFR(summary.avgTimeToFirstResponse)}
        icon={<Clock className="size-4" />}
        variant={
          summary.avgTimeToFirstResponse &&
          summary.avgTimeToFirstResponse < 3600
            ? "success"
            : "warning"
        }
      />
      <KPICard
        title="Lembretes Enviados"
        value={(summary.sentReminders ?? 0).toLocaleString("pt-BR")}
        icon={<BellRing className="size-4" />}
        variant="success"
        onClick={onSentRemindersClick}
      />
    </div>
  );
}
