"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Line,
  LineChart,
  Area,
  AreaChart,
  RadialBar,
  RadialBarChart,
  PolarGrid,
  Label,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AttendantData, ChartType } from "@/features/insights/types";

interface AttendantChartProps {
  data: AttendantData[];
  chartType: ChartType;
  onClick?: (leadIds?: string[]) => void;
}

const ATTENDANT_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(330, 81%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(173, 80%, 40%)",
];

export function AttendantChart({ data, chartType, onClick }: AttendantChartProps) {
  const chartData = data.map((item, index) => ({
    name: item.isUnassigned
      ? "Não atribuído"
      : item.responsible?.name || "Desconhecido",
    total: item.total,
    won: item.won,
    breakdown: item.breakdown,
    leadIds: item.leadIds,
    rate: item.total > 0 ? Math.round((item.won / item.total) * 100) : 0,
    fill: ATTENDANT_COLORS[index % ATTENDANT_COLORS.length],
  }));

  const chartConfig: ChartConfig = {
    total: {
      label: "Total de Leads",
      color: "hsl(221, 83%, 53%)",
    },
    won: {
      label: "Leads Ganhos",
      color: "hsl(142, 71%, 45%)",
    },
    rate: {
      label: "Taxa de Conversão",
      color: "hsl(38, 92%, 50%)",
    },
  };

  const totalLeads = chartData.reduce((sum, item) => sum + item.total, 0);
  const totalWon = chartData.reduce((sum, item) => sum + item.won, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm min-w-[180px]">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 border-b pb-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: data.fill }}
              />
              <span className="font-bold">{data.name}</span>
            </div>
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-mono font-medium">{data.total}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Ganhos:</span>
                <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  {data.won}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Conversão:</span>
                <span className="font-mono font-medium">{data.rate}%</span>
              </div>

              {data.breakdown && data.breakdown.length > 1 && (
                <div className="mt-1 flex flex-col gap-1.5 border-t pt-1">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Breakdown por Tracking
                  </span>
                  {data.breakdown.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex flex-col gap-0.5 border-l-2 pl-2 py-0.5 text-[11px]"
                    >
                      <span className="font-medium text-foreground truncate max-w-[170px]">
                        {item.name}
                      </span>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>
                          Total:{" "}
                          <span className="text-foreground font-mono">
                            {item.count}
                          </span>
                        </span>
                        <span>
                          Ganhos:{" "}
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                            {item.won}
                          </span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  switch (chartType) {
    case "bar":
      return (
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 24 }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              width={100}
              tick={{ fontSize: 11 }}
            />
            <XAxis type="number" hide />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="total"
              fill="hsl(221, 83%, 53%)"
              radius={4}
              name="total"
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
            />
            <Bar
              dataKey="won"
              fill="hsl(142, 71%, 45%)"
              radius={4}
              name="won"
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
            />
          </BarChart>
        </ChartContainer>
      );

    case "pie":
      const pieData = chartData.map((item) => ({
        ...item,
        value: item.total,
      }));
      return (
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[300px] w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
              className={onClick ? "cursor-pointer" : ""}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    const conversionRate =
                      totalLeads > 0
                        ? Math.round((totalWon / totalLeads) * 100)
                        : 0;
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {conversionRate}%
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Conversão
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </PieChart>
        </ChartContainer>
      );

    case "line":
      return (
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12, bottom: 40 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="total"
              type="monotone"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
              dot={{ fill: "hsl(221, 83%, 53%)", r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line
              dataKey="won"
              type="monotone"
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              dot={{ fill: "hsl(142, 71%, 45%)", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      );

    case "area":
      return (
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12, bottom: 40 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <defs>
              <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(221, 83%, 53%)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(221, 83%, 53%)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillWon" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(142, 71%, 45%)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(142, 71%, 45%)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="total"
              type="natural"
              fill="url(#fillTotal)"
              fillOpacity={0.4}
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
              stackId="a"
            />
            <Area
              dataKey="won"
              type="natural"
              fill="url(#fillWon)"
              fillOpacity={0.4}
              stroke="hsl(142, 71%, 45%)"
              strokeWidth={2}
              stackId="b"
            />
          </AreaChart>
        </ChartContainer>
      );

    case "radial":
      const radialData = chartData.map((item) => ({
        ...item,
        value: item.rate,
      }));
      return (
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[300px] w-full"
        >
          <RadialBarChart
            data={radialData}
            startAngle={-90}
            endAngle={380}
            innerRadius={30}
            outerRadius={110}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
            />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <RadialBar
              dataKey="value"
              background
              cornerRadius={10}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
              className={onClick ? "cursor-pointer" : ""}
            >
              {radialData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </RadialBar>
            <ChartLegend
              content={<ChartLegendContent nameKey="name" />}
              className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
            />
          </RadialBarChart>
        </ChartContainer>
      );

    default:
      return null;
  }
}
