"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  MessageSquare,
  Flame,
  Calendar,
  Sparkles,
  Layers,
  ListTodo,
  FormInput,
  Inbox,
  Wallet,
  Link2,
  Coins,
  Star,
  Rocket,
  Map as MapIcon,
  Megaphone,
  Target,
  Store,
  Gift,
  CheckIcon,
  ChevronDownIcon,
  XIcon,
  Satellite,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { appSectionElementId } from "./apps-sections";
import type { AppModule } from "@/features/insights/types";
import { ALL_MODULES } from "@/features/insights/types";
import { useDashboardStore } from "../hooks/use-dashboard-store";

export type { AppModule };
export { ALL_MODULES };

interface ModuleDef {
  id: AppModule;
  label: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  bg: string;
  activeBg: string;
  border: string;
}

export const MODULE_DEFS: ModuleDef[] = [
  {
    id: "tracking",
    label: "Tracking",
    icon: BarChart3,
    color: "text-success",
    bg: "bg-success/10 dark:bg-success/15",
    activeBg: "bg-success",
    border: "border-success",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "forge",
    label: "Forge",
    icon: Flame,
    color: "text-warning",
    bg: "bg-warning/10 dark:bg-warning/15",
    activeBg: "bg-warning",
    border: "border-warning",
  },
  {
    id: "spacetime",
    label: "SpaceTime",
    icon: Calendar,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "nasa-planner",
    label: "ÓRBITA Planner",
    icon: Sparkles,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "integrations",
    label: "Satélites",
    icon: Satellite,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: ListTodo,
    color: "text-warning",
    bg: "bg-warning/10 dark:bg-warning/15",
    activeBg: "bg-warning",
    border: "border-warning",
  },
  {
    id: "forms",
    label: "Formulários",
    icon: FormInput,
    color: "text-success",
    bg: "bg-success/10 dark:bg-success/15",
    activeBg: "bg-success",
    border: "border-success",
  },
  {
    id: "nbox",
    label: "N-Box",
    icon: Inbox,
    color: "text-muted-foreground",
    bg: "bg-muted dark:bg-background/40",
    activeBg: "bg-knob",
    border: "border-line",
  },
  {
    id: "payment",
    label: "Pagamentos",
    icon: Wallet,
    color: "text-success",
    bg: "bg-success/10 dark:bg-success/15",
    activeBg: "bg-success",
    border: "border-success",
  },
  {
    id: "linnker",
    label: "Linnker",
    icon: Link2,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "space-points",
    label: "Space Points",
    icon: Coins,
    color: "text-warning",
    bg: "bg-warning/10 dark:bg-warning/15",
    activeBg: "bg-warning",
    border: "border-warning",
  },
  {
    id: "stars",
    label: "Stars",
    icon: Star,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "space-station",
    label: "Space Station",
    icon: Rocket,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  {
    id: "nasa-route",
    label: "ÓRBITA Route",
    icon: MapIcon,
    color: "text-info",
    bg: "bg-info/10 dark:bg-info/15",
    activeBg: "bg-info",
    border: "border-info",
  },
  { id: "campanhas", label: "Campanhas", icon: Megaphone, color: "text-info", bg: "bg-info/10", activeBg: "bg-info", border: "border-info" },
  { id: "trafego", label: "trafeGO", icon: Target, color: "text-info", bg: "bg-info/10", activeBg: "bg-info", border: "border-info" },
  { id: "nerp", label: "NERP", icon: Store, color: "text-info", bg: "bg-info/10", activeBg: "bg-info", border: "border-info" },
  { id: "star-friends", label: "Star Friends", icon: Gift, color: "text-info", bg: "bg-info/10", activeBg: "bg-info", border: "border-info" },
];

interface AppSelectorProps {
  selected: AppModule[];
  onChange: (modules: AppModule[]) => void;
}

// Apps escolhidos aparecem em pílula escura na mesma linha; o seletor fica neutro (padrão do design system).
const CHIP_BASE =
  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors";
const CHIP_SELECTED = "border-transparent bg-foreground text-background";
const CHIP_UNSELECTED = "border-line bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground";

/** Rola até a seção do App mais abaixo na página (âncora criada em `apps-sections.tsx`). */
function scrollToAppSection(moduleId: AppModule) {
  document.getElementById(appSectionElementId(moduleId))?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AppSelector({ selected, onChange }: AppSelectorProps) {
  const allSelected = selected.length === ALL_MODULES.length;
  // moduleOrder vem do store persistido (ordem do drag em Configurações). Apps novos que ainda
  // não estão salvos lá entram no fim, senão nem apareceriam no seletor.
  const { moduleOrder } = useDashboardStore();
  const orderedIds: AppModule[] = [
    ...moduleOrder.filter((moduleId: AppModule) => ALL_MODULES.includes(moduleId)),
    ...ALL_MODULES.filter((moduleId) => !moduleOrder.includes(moduleId)),
  ];
  const orderedModules = orderedIds
    .map((moduleId) => MODULE_DEFS.find((moduleDef) => moduleDef.id === moduleId))
    .filter((moduleDef): moduleDef is ModuleDef => Boolean(moduleDef));
  const selectedModules = orderedModules.filter((moduleDef) => selected.includes(moduleDef.id));

  const toggle = (moduleId: AppModule) => {
    if (selected.includes(moduleId)) {
      if (selected.length === 1) return;
      onChange(selected.filter((selectedId) => selectedId !== moduleId));
      return;
    }
    onChange([...selected, moduleId]);
  };

  const toggleAll = () => {
    onChange(allSelected ? ["tracking"] : ALL_MODULES);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={cn(CHIP_BASE, allSelected ? CHIP_SELECTED : CHIP_UNSELECTED)}>
            <Layers className="size-3.5" />
            {allSelected ? "Todos os Apps" : `Apps · ${selected.length}`}
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-1.5">
          <button
            type="button"
            onClick={toggleAll}
            className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm font-medium hover:bg-accent"
          >
            <Layers className="size-4 text-muted-foreground" />
            <span className="flex-1">Todos os Apps</span>
            {allSelected && <CheckIcon className="size-4" />}
          </button>
          <div className="my-1 h-px bg-line" />
          <div className="max-h-80 overflow-y-auto">
            {orderedModules.map((moduleDef) => {
              const ModuleIcon = moduleDef.icon;
              const isSelected = selected.includes(moduleDef.id);
              return (
                <button
                  key={moduleDef.id}
                  type="button"
                  onClick={() => toggle(moduleDef.id)}
                  className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-left text-sm hover:bg-accent"
                >
                  <ModuleIcon className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{moduleDef.label}</span>
                  {isSelected && <CheckIcon className="size-4" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {!allSelected &&
        selectedModules.map((moduleDef) => {
          const ModuleIcon = moduleDef.icon;
          return (
            <span key={moduleDef.id} className={cn(CHIP_BASE, CHIP_SELECTED, "pr-1.5")}>
              <button
                type="button"
                onClick={() => scrollToAppSection(moduleDef.id)}
                title={`Ir para ${moduleDef.label}`}
                className="flex items-center gap-1.5"
              >
                <ModuleIcon className="size-3.5" />
                {moduleDef.label}
              </button>
              {selected.length > 1 && (
                <button
                  type="button"
                  onClick={() => toggle(moduleDef.id)}
                  aria-label={`Tirar ${moduleDef.label} do filtro`}
                  className="grid size-4 place-items-center rounded-full hover:bg-background/20"
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </span>
          );
        })}
    </div>
  );
}
