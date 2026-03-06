"use client";

import { Settings, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { DashboardSettings, ChartType } from "@/features/insights/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsPanelProps {
  settings: DashboardSettings;
  onToggleSection: (
    section: keyof DashboardSettings["visibleSections"],
  ) => void;
  onChartTypeChange: (
    chart: keyof DashboardSettings["chartTypes"],
    type: ChartType,
  ) => void;
  onReset: () => void;
}

const sectionLabels: Record<
  keyof DashboardSettings["visibleSections"],
  string
> = {
  summary: "Resumo (KPIs)",
  byStatus: "Por Status",
  byChannel: "Por Canal",
  byAttendant: "Por Atendente",
  topTags: "Top Tags",
};

const chartTypeLabels: Record<ChartType, string> = {
  bar: "Barras",
  pie: "Pizza",
  line: "Linha",
  area: "Área",
  radial: "Radial",
};

export function SettingsPanel({
  settings,
  onToggleSection,
  onChartTypeChange,
  onReset,
}: SettingsPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Configurações do Dashboard</SheetTitle>
          <SheetDescription>
            Personalize quais seções e tipos de gráficos você deseja visualizar.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Visibility Section */}
          <div className="px-4">
            <h3 className="mb-4 text-sm font-medium">Seções Visíveis</h3>
            <div className="space-y-4">
              {(
                Object.keys(settings.visibleSections) as Array<
                  keyof DashboardSettings["visibleSections"]
                >
              ).map((section) => (
                <div
                  key={section}
                  className="flex items-center justify-between"
                >
                  <Label
                    htmlFor={`section-${section}`}
                    className="flex items-center gap-2"
                  >
                    {settings.visibleSections[section] ? (
                      <Eye className="h-4 w-4 text-primary" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    {sectionLabels[section]}
                  </Label>
                  <Switch
                    id={`section-${section}`}
                    checked={settings.visibleSections[section]}
                    onCheckedChange={() => onToggleSection(section)}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Chart Types Section */}
          <div className="px-4">
            <h3 className="mb-4 text-sm font-medium">Tipos de Gráfico</h3>
            <div className="space-y-4">
              {(
                Object.keys(settings.chartTypes) as Array<
                  keyof DashboardSettings["chartTypes"]
                >
              ).map((chart) => (
                <div
                  key={chart}
                  className="flex items-center justify-between gap-4"
                >
                  <Label htmlFor={`chart-${chart}`}>
                    {sectionLabels[chart as keyof typeof sectionLabels]}
                  </Label>
                  <Select
                    value={settings.chartTypes[chart]}
                    onValueChange={(value) =>
                      onChartTypeChange(chart, value as ChartType)
                    }
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(chartTypeLabels) as ChartType[]).map(
                        (type) => (
                          <SelectItem key={type} value={type}>
                            {chartTypeLabels[type]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Reset Button */}
          <Button variant="outline" className="w-full mx-4" onClick={onReset}>
            <RotateCcw className="size-4" />
            Restaurar Padrões
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
