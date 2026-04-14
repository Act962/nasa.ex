"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
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
import type { StatusData, ChartType } from "@/features/insights/types";
import { useIsMobile, useIsTinyMobile } from "@/hooks/use-mobile";

interface StatusChartProps {
  data: StatusData[];
  chartType: ChartType;
  onClick?: (leadIds?: string[]) => void;
}

const STATUS_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(173, 80%, 40%)",
];

export function StatusChart({ data, chartType, onClick }: StatusChartProps) {
  const isMobile = useIsMobile();
  const isTinyMobile = useIsTinyMobile();

  const chartData = data.map((item, index) => ({
    status: item.status.name,
    count: item.count,
    breakdown: item.breakdown,
    leadIds: item.leadIds,
    fill: item.status.color || STATUS_COLORS[index % STATUS_COLORS.length],
  }));

  const chartConfig = data.reduce<ChartConfig>(
    (acc, item, index) => ({
      ...acc,
      [item.status.name]: {
        label: item.status.name,
        color: item.status.color || STATUS_COLORS[index % STATUS_COLORS.length],
      },
    }),
    {
      count: { label: "Quantidade" },
    },
  );

  const totalLeads = chartData.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: data.fill }}
              />
              <span className="font-bold">{data.status}</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-mono font-medium">{data.count}</span>
              </div>
              {data.breakdown && data.breakdown.length > 1 && (
                <div className="mt-1 border-t pt-1">
                  {data.breakdown.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-4 text-xs"
                    >
                      <span className="text-muted-foreground truncate max-w-[120px]">
                        {item.name}:
                      </span>
                      <span className="font-mono font-medium">{item.count}</span>
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
        <ChartContainer config={chartConfig} className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}>
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: isTinyMobile ? -20 : 0, right: 16 }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="status"
              type="category"
              tickLine={false}
              tickMargin={isTinyMobile ? 4 : 10}
              axisLine={false}
              width={isTinyMobile ? 0 : (isMobile ? 80 : 100)}
              tick={{ fontSize: isTinyMobile ? 9 : (isMobile ? 10 : 12) }}
              hide={isTinyMobile}
            />
            <XAxis type="number" hide />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              radius={4}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="count"
                position={isTinyMobile ? "insideLeft" : "right"}
                offset={isTinyMobile ? 4 : 8}
                className={isTinyMobile ? "fill-white font-bold" : "fill-foreground"}
                fontSize={isTinyMobile ? 10 : 12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      );

    case "pie":
      return (
        <ChartContainer
          config={chartConfig}
          className={`mx-auto ${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={isTinyMobile ? 50 : 60}
              outerRadius={isTinyMobile ? 70 : 80}
              strokeWidth={5}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
              className={onClick ? "cursor-pointer" : ""}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
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
                          className={`fill-foreground font-bold ${isTinyMobile ? "text-xl" : "text-2xl sm:text-3xl"}`}
                        >
                          {totalLeads.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + (isTinyMobile ? 18 : 24)}
                          className={`fill-muted-foreground ${isTinyMobile ? "text-[10px]" : "text-xs sm:text-sm"}`}
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="status" />}
              className={`-translate-y-2 flex-wrap gap-2 ${isTinyMobile ? "*:basis-1/2 text-[9px]" : (isMobile ? "*:basis-1/3" : "*:basis-1/4")} *:justify-center`}
            />
          </PieChart>
        </ChartContainer>
      );

    case "line":
      return (
        <ChartContainer config={chartConfig} className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}>
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="status"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isTinyMobile ? 9 : (isMobile ? 10 : 12) }}
              hide={isTinyMobile}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} hide={isTinyMobile} />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Line
              dataKey="count"
              type="natural"
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
              dot={{ fill: "hsl(221, 83%, 53%)", r: isTinyMobile ? 2 : 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      );

    case "area":
      return (
        <ChartContainer config={chartConfig} className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{ left: 12, right: 12 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="status"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isTinyMobile ? 9 : (isMobile ? 10 : 12) }}
              hide={isTinyMobile}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} hide={isTinyMobile} />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <defs>
              <linearGradient id="fillStatus" x1="0" y1="0" x2="0" y2="1">
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
            </defs>
            <Area
              dataKey="count"
              type="natural"
              fill="url(#fillStatus)"
              fillOpacity={0.4}
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      );

    case "radial":
      return (
        <ChartContainer
          config={chartConfig}
          className={`mx-auto ${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <RadialBarChart
            data={chartData}
            startAngle={-90}
            endAngle={380}
            innerRadius={isTinyMobile ? 25 : 30}
            outerRadius={isTinyMobile ? 90 : 110}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={isTinyMobile ? [70, 60] : [86, 74]}
            />
            <ChartTooltip
              cursor={false}
              content={<CustomTooltip />}
            />
            <RadialBar
              dataKey="count"
              background
              cornerRadius={10}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
              className={onClick ? "cursor-pointer" : ""}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </RadialBar>
            {chartData && chartData.length <= 9 && (
              <ChartLegend
                content={<ChartLegendContent nameKey="status" />}
                className={`-translate-y-2 flex-wrap gap-2 ${isTinyMobile ? "*:basis-1/2 text-[9px]" : (isMobile ? "*:basis-1/3" : "*:basis-1/4")} *:justify-center`}
              />
            )}
          </RadialBarChart>
        </ChartContainer>
      );

    default:
      return null;
  }
}
