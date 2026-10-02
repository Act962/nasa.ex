"use client";

import { Clock, Sparkles, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { COURSE_LEVEL_LABELS } from "../../types";

interface CoursePlayerHeaderProps {
  title: string;
  subtitle: string | null;
  level: string;
  durationMin: number | null;
  rewardSpOnComplete: number;
  isFullyComplete: boolean;
  isFreeAccess: boolean;
  planName: string | null;
  completedCount: number;
  totalCount: number;
}

/** Topo do player: compacto no celular (título + progresso), cartão destacado no computador. */
export function CoursePlayerHeader({
  title,
  subtitle,
  level,
  durationMin,
  rewardSpOnComplete,
  isFullyComplete,
  isFreeAccess,
  planName,
  completedCount,
  totalCount,
}: CoursePlayerHeaderProps) {
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <header className="lg:rounded-[24px] lg:border lg:border-line lg:bg-gradient-to-br lg:from-info/10 lg:via-info/5 lg:to-transparent lg:p-8">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="secondary">{COURSE_LEVEL_LABELS[level] ?? level}</Badge>
        {durationMin && (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" />
            {durationMin} min
          </span>
        )}
        {isFullyComplete && (
          <Badge className="bg-warning text-white hover:bg-warning">
            <Trophy className="mr-1 size-3" />
            Concluído
          </Badge>
        )}
        {isFreeAccess && (
          <Badge variant="outline" className="border-success/30 text-success max-md:hidden">
            Acesso livre
          </Badge>
        )}
        {planName && (
          <Badge variant="outline" className="border-info/30 text-info max-md:hidden">
            Plano: {planName}
          </Badge>
        )}
      </div>
      <h1 className="mt-2 line-clamp-2 text-xl leading-tight font-bold tracking-tight md:text-3xl lg:mt-3 lg:text-4xl">
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-lg text-muted-foreground max-lg:hidden">{subtitle}</p>}

      {rewardSpOnComplete > 0 && (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-info/15 px-3 py-1.5 text-sm font-medium text-info max-lg:hidden">
          <Sparkles className="size-4" />+{rewardSpOnComplete} SP de bônus ao concluir
        </div>
      )}

      <div className="mt-3 lg:mt-5">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {completedCount} / {totalCount} aulas concluídas
          </span>
          <span>{Math.round(progressPct)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted lg:bg-background">
          <div
            className={cn("h-full rounded-full transition-all", isFullyComplete ? "bg-warning" : "bg-info")}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </header>
  );
}
