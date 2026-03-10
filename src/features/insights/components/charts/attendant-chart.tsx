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
}

const ATTENDANT_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(330, 81%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(173, 80%, 40%)",
];

export function AttendantChart({ data, chartType }: AttendantChartProps) {
  const chartData = data.map((item, index) => ({
    name: item.isUnassigned
      ? "Não atribuído"
      : item.responsible?.name || "Desconhecido",
    total: item.total,
    won: item.won,
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

  switch (chartType) {
    case "bar":
      return (
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 24 }}
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
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, name) => (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            name === "total"
                              ? "hsl(221, 83%, 53%)"
                              : "hsl(142, 71%, 45%)",
                        }}
                      />
                      <span className="text-muted-foreground">
                        {name === "total" ? "Total" : "Ganhos"}:
                      </span>
                      <span className="font-mono font-medium">{value}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="total"
              fill="hsl(221, 83%, 53%)"
              radius={4}
              name="total"
            />
            <Bar
              dataKey="won"
              fill="hsl(142, 71%, 45%)"
              radius={4}
              name="won"
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
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-mono font-medium">{value}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Ganhos:</span>
                        <span className="font-mono font-medium">
                          {item.payload.won}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Taxa:</span>
                        <span className="font-mono font-medium">
                          {item.payload.rate}%
                        </span>
                      </div>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
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
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
              content={<ChartTooltipContent indicator="dot" />}
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
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="name"
                  formatter={(value) => (
                    <span className="font-mono font-medium">{value}%</span>
                  )}
                />
              }
            />
            <RadialBar dataKey="value" background cornerRadius={10}>
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
