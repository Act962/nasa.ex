"use client";

import { cn } from "@/lib/utils";
import {
  BarChart3,
  MessageSquare,
  Flame,
  Calendar,
  Sparkles,
  Layers,
  Plug,
  ListTodo,
  FormInput,
  Inbox,
  Wallet,
  Link2,
  Coins,
  Star,
  Rocket,
  Map as MapIcon,
} from "lucide-react";
import type { AppModule } from "@/features/insights/types";
import { ALL_MODULES } from "@/features/insights/types";

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
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    activeBg: "bg-emerald-600",
    border: "border-emerald-500",
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    activeBg: "bg-violet-600",
    border: "border-violet-500",
  },
  {
    id: "forge",
    label: "Forge",
    icon: Flame,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    activeBg: "bg-orange-600",
    border: "border-orange-500",
  },
  {
    id: "spacetime",
    label: "SpaceTime",
    icon: Calendar,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    activeBg: "bg-blue-600",
    border: "border-blue-500",
  },
  {
    id: "nasa-planner",
    label: "NASA Planner",
    icon: Sparkles,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/40",
    activeBg: "bg-pink-600",
    border: "border-pink-500",
  },
  {
    id: "integrations",
    label: "Integrações",
    icon: Plug,
    color: "text-cyan-600",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    activeBg: "bg-cyan-600",
    border: "border-cyan-500",
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: ListTodo,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    activeBg: "bg-amber-600",
    border: "border-amber-500",
  },
  {
    id: "forms",
    label: "Formulários",
    icon: FormInput,
    color: "text-teal-600",
    bg: "bg-teal-50 dark:bg-teal-950/40",
    activeBg: "bg-teal-600",
    border: "border-teal-500",
  },
  {
    id: "nbox",
    label: "N-Box",
    icon: Inbox,
    color: "text-slate-600",
    bg: "bg-slate-50 dark:bg-slate-950/40",
    activeBg: "bg-slate-600",
    border: "border-slate-500",
  },
  {
    id: "payment",
    label: "Pagamentos",
    icon: Wallet,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/40",
    activeBg: "bg-green-600",
    border: "border-green-500",
  },
  {
    id: "linnker",
    label: "Linnker",
    icon: Link2,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    activeBg: "bg-purple-600",
    border: "border-purple-500",
  },
  {
    id: "space-points",
    label: "Space Points",
    icon: Coins,
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    activeBg: "bg-yellow-600",
    border: "border-yellow-500",
  },
  {
    id: "stars",
    label: "Stars",
    icon: Star,
    color: "text-fuchsia-600",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    activeBg: "bg-fuchsia-600",
    border: "border-fuchsia-500",
  },
  {
    id: "space-station",
    label: "Space Station",
    icon: Rocket,
    color: "text-indigo-600",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    activeBg: "bg-indigo-600",
    border: "border-indigo-500",
  },
  {
    id: "nasa-route",
    label: "NASA Route",
    icon: MapIcon,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    activeBg: "bg-sky-600",
    border: "border-sky-500",
  },
];

interface AppSelectorProps {
  selected: AppModule[];
  onChange: (modules: AppModule[]) => void;
}

export function AppSelector({ selected, onChange }: AppSelectorProps) {
  const allSelected = selected.length === ALL_MODULES.length;

  const toggle = (id: AppModule) => {
    const isActive = selected.includes(id);
    if (isActive) {
      if (selected.length === 1) return;
      onChange(selected.filter((m) => m !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const toggleAll = () => {
    onChange(allSelected ? ["tracking"] : ALL_MODULES);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* All toggle */}
      <button
        onClick={toggleAll}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all",
          allSelected
            ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent"
            : "border-border text-muted-foreground hover:border-muted-foreground/50",
        )}
      >
        <Layers className="size-3.5" />
        Todos os Apps
      </button>

      <div className="w-px h-5 bg-border" />

      {MODULE_DEFS.map((mod) => {
        const isActive = selected.includes(mod.id);
        const Icon = mod.icon;
        return (
          <button
            key={mod.id}
            onClick={() => toggle(mod.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
              isActive
                ? `${mod.activeBg} text-white border-transparent shadow-sm`
                : `${mod.bg} ${mod.color} border-border hover:${mod.border}`,
            )}
          >
            <Icon className="size-3.5" />
            {mod.label}
          </button>
        );
      })}
    </div>
  );
}
