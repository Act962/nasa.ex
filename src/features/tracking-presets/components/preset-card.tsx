"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import * as LucideIcons from "lucide-react";
import {
  TagIcon,
  WorkflowIcon,
  LayoutListIcon,
  StarIcon,
} from "lucide-react";

type Paradigm = "REATIVO" | "PROATIVO" | "PREDITIVO" | "AUTOATENDIMENTO";

export interface PresetCardData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  paradigm: Paradigm;
  icon: string | null;
  color: string | null;
  starsCost: number;
  summary: {
    statusCount: number;
    tagsCount: number;
    workflowsCount: number;
    activeWorkflowsCount: number;
  };
}

const ParadigmLabel: Record<Paradigm, string> = {
  REATIVO: "Reativo",
  PROATIVO: "Proativo",
  PREDITIVO: "Preditivo",
  AUTOATENDIMENTO: "Autoatendimento",
};

/**
 * Card clicável do catálogo de presets. Icone do lucide (resolvido por nome),
 * cor de fundo do preset, e 3 badges com counts (status / tags / workflows).
 * Badge dourado de stars se starsCost > 0.
 */
export function PresetCard({
  preset,
  onClick,
}: {
  preset: PresetCardData;
  onClick: () => void;
}) {
  // Resolve icon dinâmico do lucide. Fallback: LayoutListIcon.
  const IconComponent =
    preset.icon && (LucideIcons as any)[preset.icon]
      ? ((LucideIcons as any)[preset.icon] as React.ComponentType<{
          className?: string;
        }>)
      : LayoutListIcon;

  const accentColor = preset.color ?? "#6366f1";

  return (
    <Card
      role="button"
      onClick={onClick}
      className="group relative flex flex-col gap-3 p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Header: icon + nome + paradigm badge */}
      <div className="flex items-start gap-3">
        <div
          className="size-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
        >
          <IconComponent className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight">{preset.name}</h3>
          <Badge variant="outline" className="mt-1 text-[10px]">
            {ParadigmLabel[preset.paradigm]}
          </Badge>
        </div>
        {preset.starsCost > 0 && (
          <Badge className="bg-amber-500 text-white text-[10px] gap-1">
            <StarIcon className="size-2.5" />
            {preset.starsCost}
          </Badge>
        )}
      </div>

      {preset.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">
          {preset.description}
        </p>
      )}

      {/* Footer: counts */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-auto pt-2 border-t">
        <span className="inline-flex items-center gap-1">
          <LayoutListIcon className="size-3" />
          {preset.summary.statusCount} status
        </span>
        <span className="inline-flex items-center gap-1">
          <TagIcon className="size-3" />
          {preset.summary.tagsCount} tags
        </span>
        <span className="inline-flex items-center gap-1">
          <WorkflowIcon className="size-3" />
          {preset.summary.workflowsCount}
          {preset.summary.activeWorkflowsCount <
            preset.summary.workflowsCount &&
            ` (${preset.summary.activeWorkflowsCount} ativas)`}
        </span>
      </div>
    </Card>
  );
}
