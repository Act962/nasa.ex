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
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AttendantData, ChartType } from "@/features/insights/types";
import { useIsMobile, useIsTinyMobile } from "@/hooks/use-mobile";
import { OthersTable } from "./others-table";

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
  "hsl(173, 80%, 40%)",
  "hsl(262, 83%, 58%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
];

const MAX_VISIBLE = 8;
const OTHERS_FILL = "hsl(220, 9%, 46%)";

export function AttendantChart({
  data,
  chartType,
  onClick,
}: AttendantChartProps) {
  const isMobile = useIsMobile();
  const isTinyMobile = useIsTinyMobile();

  const allChartData = data.map((item, index) => ({
    attendant: item.responsible?.name,
    count: item.total,
    wonLeads: item.won,
    leadIds: item.leadIds,
    fill: ATTENDANT_COLORS[index % ATTENDANT_COLORS.length],
  }));

  const totalLeads = allChartData.reduce((sum, item) => sum + item.count, 0);

  const sortedData = [...allChartData].sort((a, b) => b.count - a.count);
  const hasOthers = sortedData.length > MAX_VISIBLE;
  const visibleData = hasOthers
    ? [
        ...sortedData.slice(0, MAX_VISIBLE),
        {
          attendant: "Outros",
          count: sortedData.slice(MAX_VISIBLE).reduce((s, i) => s + i.count, 0),
          wonLeads: sortedData.slice(MAX_VISIBLE).reduce((s, i) => s + i.wonLeads, 0),
          leadIds: sortedData.slice(MAX_VISIBLE).flatMap((i) => i.leadIds),
          fill: OTHERS_FILL,
        },
      ]
    : sortedData;
  const hiddenItems = hasOthers
    ? sortedData
        .slice(MAX_VISIBLE)
        .map((i) => ({ name: i.attendant ?? "—", count: i.count, leadIds: i.leadIds, fill: i.fill }))
    : [];

  const chartConfig = data.reduce<ChartConfig>(
    (acc, item, index) => ({
      ...acc,
      [item.responsible?.name || ""]: {
        label: item.responsible?.name,
        color: ATTENDANT_COLORS[index % ATTENDANT_COLORS.length],
      },
    }),
    {
      count: { label: "Total Leads" },
      wonLeads: { label: "Ganhos" },
    },
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="rounded-lg border bg-background p-2 shadow-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 border-b pb-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: d.fill }}
              />
              <span className="font-bold">{d.attendant}</span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Total:</span>
                <span className="font-mono font-medium">{d.count}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Ganhos:</span>
                <span className="font-mono font-medium text-green-600">
                  {d.wonLeads}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 border-t mt-1 pt-1">
                <span className="text-muted-foreground">Taxa:</span>
                <span className="font-mono font-medium">
                  {d.conversionRate}%
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  let chartContent: React.ReactNode;

  switch (chartType) {
    case "bar":
      chartContent = (
        <ChartContainer
          config={chartConfig}
          className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <BarChart
            accessibilityLayer
            data={visibleData}
            layout="vertical"
            margin={{ left: isTinyMobile ? -20 : 0, right: 16 }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="attendant"
              type="category"
              tickLine={false}
              tickMargin={isTinyMobile ? 4 : 10}
              axisLine={false}
              width={isTinyMobile ? 0 : isMobile ? 80 : 100}
              tick={{ fontSize: isTinyMobile ? 9 : isMobile ? 10 : 12 }}
              hide={isTinyMobile}
            />
            <XAxis type="number" hide />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Bar
              dataKey="count"
              radius={4}
              onClick={(d: any) =>
                onClick?.(d?.payload?.leadIds || d?.leadIds)
              }
            >
              {visibleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList
                dataKey="count"
                position={isTinyMobile ? "insideLeft" : "right"}
                offset={isTinyMobile ? 4 : 8}
                className={
                  isTinyMobile ? "fill-white font-bold" : "fill-foreground"
                }
                fontSize={isTinyMobile ? 10 : 12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      );
      break;

    case "pie":
      chartContent = (
        <ChartContainer
          config={chartConfig}
          className={`mx-auto ${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <PieChart>
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <Pie
              data={visibleData}
              dataKey="count"
              nameKey="attendant"
              innerRadius={isTinyMobile ? 50 : 60}
              outerRadius={isTinyMobile ? 70 : 80}
              strokeWidth={5}
              onClick={(d: any) =>
                onClick?.(d?.payload?.leadIds || d?.leadIds)
              }
              className={onClick ? "cursor-pointer" : ""}
            >
              {visibleData.map((entry, index) => (
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
                          Leads
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="attendant" />}
              className={`-translate-y-2 flex-wrap gap-2 ${isTinyMobile ? "*:basis-1/2 text-[9px]" : isMobile ? "*:basis-1/3" : "*:basis-1/4"} *:justify-center`}
            />
          </PieChart>
        </ChartContainer>
      );
      break;

    case "line":
      chartContent = (
        <ChartContainer
          config={chartConfig}
          className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <LineChart
            accessibilityLayer
            data={visibleData}
            margin={{ left: 12, right: 12, bottom: 40 }}
            onClick={(e: any) => {
              if (e?.activePayload?.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="attendant"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isTinyMobile ? 9 : isMobile ? 10 : 11 }}
              angle={isTinyMobile ? 0 : -45}
              textAnchor={isTinyMobile ? "middle" : "end"}
              height={isTinyMobile ? 30 : isMobile ? 60 : 70}
              hide={isTinyMobile}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              hide={isTinyMobile}
            />
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
      break;

    case "area":
      chartContent = (
        <ChartContainer
          config={chartConfig}
          className={`${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <AreaChart
            accessibilityLayer
            data={visibleData}
            margin={{ left: 12, right: 12, bottom: 40 }}
            onClick={(e: any) => {
              if (e?.activePayload?.length > 0) {
                onClick?.(e.activePayload[0].payload.leadIds);
              }
            }}
            className={onClick ? "cursor-pointer" : ""}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="attendant"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: isTinyMobile ? 9 : isMobile ? 10 : 11 }}
              angle={isTinyMobile ? 0 : -45}
              textAnchor={isTinyMobile ? "middle" : "end"}
              height={isTinyMobile ? 30 : isMobile ? 60 : 70}
              hide={isTinyMobile}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              hide={isTinyMobile}
            />
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <defs>
              <linearGradient id="fillAttendant" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(221, 83%, 53%)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <Area
              dataKey="count"
              type="natural"
              fill="url(#fillAttendant)"
              fillOpacity={0.4}
              stroke="hsl(221, 83%, 53%)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      );
      break;

    case "radial":
      chartContent = (
        <ChartContainer
          config={chartConfig}
          className={`mx-auto ${isMobile ? "h-[250px]" : "h-[300px]"} w-full`}
        >
          <RadialBarChart
            data={visibleData}
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
            <ChartTooltip cursor={false} content={<CustomTooltip />} />
            <RadialBar
              dataKey="count"
              background
              cornerRadius={10}
              onClick={(d: any) =>
                onClick?.(d?.payload?.leadIds || d?.leadIds)
              }
              className={onClick ? "cursor-pointer" : ""}
            >
              {visibleData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </RadialBar>
            <ChartLegend
              content={<ChartLegendContent nameKey="attendant" />}
              className={`-translate-y-2 flex-wrap gap-2 ${isTinyMobile ? "*:basis-1/2 text-[9px]" : isMobile ? "*:basis-1/3" : "*:basis-1/4"} *:justify-center`}
            />
          </RadialBarChart>
        </ChartContainer>
      );
      break;

    default:
      return null;
  }

  return (
    <div>
      {chartContent}
      {hasOthers && (
        <OthersTable items={hiddenItems} total={totalLeads} onClick={onClick} />
      )}
    </div>
  );
}
