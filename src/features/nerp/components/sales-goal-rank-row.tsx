"use client";

import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBrl, type SalesGoalRankEntry } from "./sales-goal-podium";
import { SalesGoalAvatar } from "./sales-goal-avatar";

export function SalesGoalRankRow({
  entry,
  position,
  showScore,
  showPercent,
  showSoldValue = true,
  accent = "#7a1fe7",
  onAdjust,
}: {
  entry: SalesGoalRankEntry;
  position: number;
  showScore: boolean;
  showPercent: boolean;
  showSoldValue?: boolean;
  accent?: string;
  onAdjust?: (entryId: string, delta: number) => void;
}) {
  const percent = Math.min(entry.percentAchieved ?? 0, 100);
  const goalReached = entry.remainingAmount <= 0 && entry.achievedAmount !== null;
  const step = Math.max(Math.round(entry.goalAmount / 20), 1);

  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-xl border border-transparent hover:bg-white/5 transition-all min-w-0">
      <span className="w-5 text-center text-sm font-bold text-muted-foreground shrink-0">
        {position}
      </span>

      <SalesGoalAvatar name={entry.sellerName} seed={entry.externalCode} size={32} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <p className="text-xs font-semibold truncate min-w-0">{entry.goalName}</p>
          <Badge
            variant={entry.entryKind === "BUCKET" ? "secondary" : "outline"}
            className="text-[8px] px-1 py-0 shrink-0 hidden @sm:inline-flex"
          >
            {entry.entryKind === "BUCKET" ? "BUCKET" : "VENDEDOR"}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">
          Meta {formatBrl(entry.goalAmount)}
          {showSoldValue && (
            <> · Vendido {entry.achievedAmount !== null ? formatBrl(entry.achievedAmount) : "—"}</>
          )}
        </p>
        <div className="flex items-center gap-1.5 mt-1 min-w-0">
          <Progress
            value={percent}
            className="h-1.5 flex-1 min-w-6 max-w-24 bg-white/10 [&>div]:bg-(--progress-fill)"
            style={{ ["--progress-fill" as string]: accent }}
          />
          {showPercent && (
            <span className="text-[9px] tabular-nums shrink-0" style={{ color: accent }}>
              {entry.percentAchieved !== null ? `${entry.percentAchieved.toFixed(0)}%` : "—"}
            </span>
          )}
        </div>
        <span
          className={cn(
            "text-[9px] truncate block",
            goalReached ? "text-emerald-500 font-semibold" : "text-muted-foreground",
          )}
        >
          {goalReached ? "🎉 Meta batida" : `Faltam ${formatBrl(entry.remainingAmount)}`}
        </span>
      </div>

      <div className="flex flex-col items-center gap-1 shrink-0">
        {showScore && (
          <span className="text-[11px] font-bold tabular-nums whitespace-nowrap" style={{ color: accent }}>
            {Math.round(entry.percentAchieved ?? 0)} pts
          </span>
        )}
        {onAdjust && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAdjust(entry.id, -step)}
              className="size-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            >
              <Minus className="size-3" />
            </button>
            <button
              onClick={() => onAdjust(entry.id, step)}
              className="size-5 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            >
              <Plus className="size-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
