"use client";

import { Settings, RotateCcw, Eye, EyeOff, GripVertical } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  DashboardSettings,
  ChartType,
  AppModule,
} from "@/features/insights/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useDashboardStore } from "../hooks/use-dashboard-store";
import { useOrgLayout } from "@/features/insights/context/org-layout-provider";
import type { InsightBlock } from "@/features/insights/lib/app-metrics";
import { MODULE_DEFS } from "./app-selector";

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
  const {
    moduleOrder,
    selectedModules,
    setModuleOrder,
    resetModuleOrder,
  } = useDashboardStore();
  // resetLayout = restaura a posição/tamanho dos blocos (widgets/cards)
  // pro padrão. Só admin/moderador (`canEdit`) consegue executar — pra
  // org's whole layout, não só layout local do usuário.
  const {
    canEdit: canEditLayout,
    resetLayout,
    blocks,
    reorderBlocks,
  } = useOrgLayout();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = moduleOrder.indexOf(active.id as AppModule);
    const newIndex = moduleOrder.indexOf(over.id as AppModule);
    if (oldIndex < 0 || newIndex < 0) return;

    const nextOrder = arrayMove(moduleOrder, oldIndex, newIndex);
    setModuleOrder(nextOrder);

    // Sincroniza com as seções do body (layout da org). Apenas
    // owner/moderador (`canEditLayout`) tem permissão de gravar o
    // novo layout — pra membros comuns, só as pills do AppSelector
    // mudam de ordem (local).
    if (canEditLayout && blocks.length > 0) {
      // Reordena somente os blocos do tipo "section" segundo nextOrder,
      // preservando posição relativa de blocos não-section (métricas,
      // tags, custom charts etc).
      const reorderedSections = nextOrder
        .map((appModule) =>
          blocks.find(
            (b) => b.type === "section" && b.appModule === appModule,
          ),
        )
        .filter((b): b is InsightBlock => !!b);

      let sectionIdx = 0;
      const newBlocks = blocks.map((b) => {
        if (b.type === "section") {
          const next = reorderedSections[sectionIdx++];
          return next ?? b;
        }
        return b;
      });

      reorderBlocks(newBlocks);
    }
  };

  const handleResetAll = () => {
    onReset();
    resetModuleOrder();
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Configurações do Dashboard</SheetTitle>
          <SheetDescription>
            Reordene os apps arrastando-os. Para mostrar/esconder, use os filtros do topo.
          </SheetDescription>
        </SheetHeader>

        {/* min-h-0 é obrigatório pro flex-1 dentro de flex-col conseguir
            shrinkar — sem isso, conteúdo grande estoura e o scroll do
            ScrollArea não ativa. Bug clássico do flexbox. */}
        <ScrollArea className="flex-1 min-h-0 px-6">
          <div className="space-y-6 py-4">
            {/* App modules — sortable */}
            <div>
              <h3 className="mb-1 text-sm font-medium">Apps no dashboard</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Arraste para reorganizar a ordem dos apps.
              </p>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={moduleOrder}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {moduleOrder.map((moduleId) => {
                      const def = MODULE_DEFS.find((m) => m.id === moduleId);
                      if (!def) return null;
                      return (
                        <SortableModuleRow
                          key={moduleId}
                          id={moduleId}
                          label={def.label}
                          icon={def.icon}
                          color={def.color}
                          bg={def.bg}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <Separator />

            {/* Visibility — Tracking sub-sections (only shown when tracking is on) */}
            {selectedModules.includes("tracking") && (
              <>
                <div>
                  <h3 className="mb-3 text-sm font-medium">
                    Seções de Tracking
                  </h3>
                  <div className="space-y-3">
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
                            <Eye className="h-4 w-4 text-muted-foreground" />
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

                <div>
                  <h3 className="mb-3 text-sm font-medium">
                    Tipos de Gráfico
                  </h3>
                  <div className="space-y-3">
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
              </>
            )}

            {/* Layout dos blocos — só aparece pra quem pode editar o
                layout da org (owner/moderador). Restaura a posição/tamanho
                dos cards arrastáveis pro padrão. */}
            {canEditLayout && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-1 text-sm font-medium">Layout dos blocos</h3>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Restaura a posição padrão dos cards arrastáveis do dashboard.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={resetLayout}
                  >
                    <RotateCcw className="size-3.5" />
                    Restaurar layout padrão
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="border-t px-6 py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleResetAll}
          >
            <RotateCcw className="size-4" />
            Restaurar padrões
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SortableModuleRowProps {
  id: AppModule;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
}

function SortableModuleRow({
  id,
  label,
  icon: Icon,
  color,
  bg,
}: SortableModuleRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-2 py-2 transition-colors",
        isDragging && "opacity-50 z-10 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Arrastar ${label}`}
        className="flex size-6 items-center justify-center rounded text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="size-4" />
      </button>
      <div
        className={cn(
          "size-7 rounded-md flex items-center justify-center shrink-0",
          bg,
        )}
      >
        <Icon className={cn("size-3.5", color)} />
      </div>
      <span className="flex-1 text-sm font-medium truncate">{label}</span>
    </div>
  );
}
