"use client";

import { useState } from "react";
import {
  BarChart3,
  PieChart,
  LineChart,
  AreaChart,
  CircleDot,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import type { ChartType } from "@/features/insights/types";
import { cn } from "@/lib/utils";

interface ChartWrapperProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  chartType: ChartType;
  onChartTypeChange: (type: ChartType) => void;
  isVisible: boolean;
  onVisibilityToggle: () => void;
  allowedChartTypes?: ChartType[];
  className?: string;
}

const chartTypeIcons: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  area: <AreaChart className="h-4 w-4" />,
  radial: <CircleDot className="h-4 w-4" />,
};

const chartTypeLabels: Record<ChartType, string> = {
  bar: "Barras",
  pie: "Pizza",
  line: "Linha",
  area: "Área",
  radial: "Radial",
};

export function ChartWrapper({
  title,
  description,
  children,
  chartType,
  onChartTypeChange,
  isVisible,
  onVisibilityToggle,
  allowedChartTypes = ["bar", "pie", "line", "area", "radial"],
  className,
}: ChartWrapperProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (!isVisible) {
    return (
      <Card
        className={cn(
          "cursor-pointer border-dashed opacity-50 transition-all hover:opacity-75",
          className,
        )}
        onClick={onVisibilityToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <EyeOff className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Clique para mostrar
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("transition-all hover:shadow-md", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Tipo de Gráfico</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allowedChartTypes.map((type) => (
                <DropdownMenuItem
                  key={type}
                  onClick={() => onChartTypeChange(type)}
                  className={cn(
                    "flex items-center gap-2",
                    chartType === type && "bg-accent",
                  )}
                >
                  {chartTypeIcons[type]}
                  {chartTypeLabels[type]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onVisibilityToggle}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">{children}</CardContent>
    </Card>
  );
}
