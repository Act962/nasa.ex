"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WhatsAppAnalyticsReport } from "../types";

interface MessagesByDayChartProps {
  data: WhatsAppAnalyticsReport["messagesByDay"];
}

const chartConfig = {
  sent: { label: "Enviadas", color: "hsl(221, 83%, 53%)" },
  delivered: { label: "Entregues", color: "hsl(142, 71%, 45%)" },
} satisfies ChartConfig;

export function MessagesByDayChart({ data }: MessagesByDayChartProps) {
  const isMobile = useIsMobile();

  const chartData = data.map((point) => ({
    ...point,
    label: format(new Date(`${point.date}T00:00:00`), "dd/MM", {
      locale: ptBR,
    }),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          Mensagens por dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className={`${isMobile ? "h-[220px]" : "h-[280px]"} w-full`}
        >
          <AreaChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isMobile ? 10 : 11 }}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillSent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sent)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-sent)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillDelivered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-delivered)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-delivered)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area
              dataKey="sent"
              type="natural"
              fill="url(#fillSent)"
              stroke="var(--color-sent)"
              strokeWidth={2}
            />
            <Area
              dataKey="delivered"
              type="natural"
              fill="url(#fillDelivered)"
              stroke="var(--color-delivered)"
              strokeWidth={2}
            />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
