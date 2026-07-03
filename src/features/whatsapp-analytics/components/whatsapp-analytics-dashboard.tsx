"use client";

import { useState } from "react";
import dayjs from "dayjs";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useWhatsAppAnalytics } from "../hooks/use-whatsapp-analytics";
import { PeriodPicker, type PeriodRange } from "./period-picker";
import { SummaryCards } from "./summary-cards";
import { MessagesByDayChart } from "./messages-by-day-chart";
import { ConversationsByCategoryChart } from "./conversations-by-category-chart";

interface WhatsAppAnalyticsDashboardProps {
  trackingId: string;
}

function defaultRange(): PeriodRange {
  return {
    from: dayjs().subtract(30, "day").startOf("day").toDate(),
    to: dayjs().endOf("day").toDate(),
  };
}

export function WhatsAppAnalyticsDashboard({
  trackingId,
}: WhatsAppAnalyticsDashboardProps) {
  const [range, setRange] = useState<PeriodRange>(defaultRange);

  const { report, isLoading, error } = useWhatsAppAnalytics({
    trackingId,
    startDate: range.from.toISOString(),
    endDate: range.to.toISOString(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">WhatsApp Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens, conversas e custo aproximado via WhatsApp Oficial (Meta
            Cloud API).
          </p>
        </div>
        <PeriodPicker value={range} onChange={setRange} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Não foi possível carregar o analytics</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}

      {report && !isLoading && (
        <>
          <SummaryCards summary={report.summary} currency={report.currency} />
          <div className="grid gap-4 lg:grid-cols-2">
            <MessagesByDayChart data={report.messagesByDay} />
            <ConversationsByCategoryChart
              data={report.conversationsByCategory}
              currency={report.currency}
            />
          </div>
        </>
      )}
    </div>
  );
}
