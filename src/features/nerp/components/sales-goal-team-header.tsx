"use client";

import { Trophy } from "lucide-react";

export function SalesGoalTeamHeader({
  teamName,
  subtitle,
  totalLabel,
  totalValue,
  top3Label,
  top3Value,
  accent,
}: {
  teamName: string;
  subtitle: string;
  totalLabel: string;
  totalValue: string;
  top3Label: string;
  top3Value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="size-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: accent + "22" }}
      >
        <Trophy className="size-4" style={{ color: accent }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold truncate">{teamName}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground whitespace-nowrap">
          {totalLabel}: <strong className="text-foreground">{totalValue}</strong>
        </span>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-muted-foreground whitespace-nowrap">
          {top3Label}: <strong className="text-emerald-400">{top3Value}</strong>
        </span>
      </div>
    </div>
  );
}
