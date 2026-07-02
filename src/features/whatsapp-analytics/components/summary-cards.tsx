"use client";

import { Send, CheckCheck, MessagesSquare, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WhatsAppAnalyticsReport } from "../types";
import { formatWhatsAppCurrency } from "../lib/format-whatsapp-currency";

interface SummaryCardsProps {
  summary: WhatsAppAnalyticsReport["summary"];
  currency: string;
}

interface SummaryCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning";
}

function SummaryCard({ title, value, icon, variant = "default" }: SummaryCardProps) {
  const iconStyles = {
    default: "bg-muted-foreground/10 text-muted-foreground",
    success: "bg-success/20 text-success",
    warning: "bg-warning/20 text-warning-foreground",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={cn("rounded-lg p-2", iconStyles[variant])}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ summary, currency }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryCard
        title="Mensagens enviadas"
        value={summary.sent.toLocaleString("pt-BR")}
        icon={<Send className="size-4" />}
      />
      <SummaryCard
        title="Mensagens entregues"
        value={summary.delivered.toLocaleString("pt-BR")}
        icon={<CheckCheck className="size-4" />}
        variant="success"
      />
      <SummaryCard
        title="Conversas"
        value={summary.conversations.toLocaleString("pt-BR")}
        icon={<MessagesSquare className="size-4" />}
      />
      <SummaryCard
        title="Custo total"
        value={formatWhatsAppCurrency(summary.totalCost, currency)}
        icon={<Wallet className="size-4" />}
        variant="warning"
      />
    </div>
  );
}
