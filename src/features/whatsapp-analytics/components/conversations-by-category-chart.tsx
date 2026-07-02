"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import type {
  WhatsAppAnalyticsReport,
  WhatsAppConversationCategory,
} from "../types";
import { formatWhatsAppCurrency } from "../lib/format-whatsapp-currency";

interface ConversationsByCategoryChartProps {
  data: WhatsAppAnalyticsReport["conversationsByCategory"];
  currency: string;
}

const CATEGORY_LABELS: Record<WhatsAppConversationCategory, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidade",
  AUTHENTICATION: "Autenticação",
  AUTHENTICATION_INTERNATIONAL: "Autenticação (internacional)",
  SERVICE: "Atendimento",
};

const CATEGORY_COLORS: Record<WhatsAppConversationCategory, string> = {
  MARKETING: "hsl(38, 92%, 50%)",
  UTILITY: "hsl(221, 83%, 53%)",
  AUTHENTICATION: "hsl(262, 83%, 58%)",
  AUTHENTICATION_INTERNATIONAL: "hsl(262, 60%, 45%)",
  SERVICE: "hsl(142, 71%, 45%)",
};

const chartConfig = {
  conversations: { label: "Conversas" },
} satisfies ChartConfig;

export function ConversationsByCategoryChart({
  data,
  currency,
}: ConversationsByCategoryChartProps) {
  const isMobile = useIsMobile();

  const chartData = data.map((item) => ({
    ...item,
    label: CATEGORY_LABELS[item.category] ?? item.category,
    fill: CATEGORY_COLORS[item.category] ?? "hsl(220, 9%, 46%)",
  }));

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: (typeof chartData)[number] }>;
  }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="flex items-center gap-2 border-b pb-1">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: point.fill }} />
          <span className="font-bold">{point.label}</span>
        </div>
        <div className="flex flex-col gap-1 pt-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Conversas:</span>
            <span className="font-mono font-medium">{point.conversations}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Custo:</span>
            <span className="font-mono font-medium">
              {formatWhatsAppCurrency(point.cost, currency)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Conversas por categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className={`${isMobile ? "h-[220px]" : "h-[280px]"} w-full`}
        >
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isMobile ? 9 : 11 }}
              interval={0}
              angle={isMobile ? -30 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 50 : 30}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar dataKey="conversations" radius={8}>
              {chartData.map((entry) => (
                <Cell key={entry.category} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
