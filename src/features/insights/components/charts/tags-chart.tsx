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
import type { TagData, ChartType } from "@/features/insights/types";

interface TagsChartProps {
  data: TagData[];
  chartType: ChartType;
  onClick?: (leadIds?: string[]) => void;
}

const TAG_COLORS = [
  "hsl(262, 83%, 58%)",
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(330, 81%, 60%)",
  "hsl(0, 84%, 60%)",
  "hsl(173, 80%, 40%)",
  "hsl(199, 89%, 48%)",
];

export function TagsChart({ data, chartType, onClick }: TagsChartProps) {
  const chartData = data.map((item, index) => ({
    tag: item.tag.name,
    count: item.count,
    breakdown: item.breakdown,
    leadIds: item.leadIds,
    fill: item.tag.color || TAG_COLORS[index % TAG_COLORS.length],
  }));

  const chartConfig = data.reduce<ChartConfig>(
    (acc, item, index) => ({
      ...acc,
      [item.tag.name]: {
        label: item.tag.name,
        color: item.tag.color || TAG_COLORS[index % TAG_COLORS.length],
      },
    }),
    {
      count: { label: "Quantidade" },
    },
  );

  const totalTags = chartData.reduce((sum, item) => sum + item.count, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 border-b pb-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: data.fill }}
              />
              <span className="font-bold">{data.tag}</span>
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
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="tag"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={70}
            />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              radius={8}
              onClick={(data: any) => onClick?.(data?.payload?.leadIds || data?.leadIds)}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                position="top"
                offset={8}
                className="fill-foreground"
                fontSize={11}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      );

    case "pie":
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
              data={chartData}
              dataKey="count"
              nameKey="tag"
              innerRadius={60}
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
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalTags.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            {chartData && chartData.length <= 9 && (
              <ChartLegend
                content={<ChartLegendContent nameKey="tag" />}
                className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
              />
            )}
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
              dataKey="tag"
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
            <Line
              dataKey="count"
              type="natural"
              stroke="hsl(262, 83%, 58%)"
              strokeWidth={2}
              dot={{ fill: "hsl(262, 83%, 58%)", r: 4 }}
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
              dataKey="tag"
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
            <defs>
              <linearGradient id="fillTags" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(262, 83%, 58%)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(262, 83%, 58%)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="count"
              type="natural"
              fill="url(#fillTags)"
              fillOpacity={0.4}
              stroke="hsl(262, 83%, 58%)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      );

    case "radial":
      return (
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[300px] w-full"
        >
          <RadialBarChart
            data={chartData}
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
                content={<ChartLegendContent nameKey="tag" />}
                className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
              />
            )}
          </RadialBarChart>
        </ChartContainer>
      );

    default:
      return null;
  }
}
