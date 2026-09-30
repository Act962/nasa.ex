"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OBLIGATION_STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  DONE: { label: "Feita", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  OVERDUE: { label: "Atrasada", className: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" },
  NOT_APPLICABLE: { label: "Não se aplica", className: "border-border bg-muted text-muted-foreground" },
};

export function ObligationStatusBadge({ status }: { status: string }) {
  const display = OBLIGATION_STATUS_DISPLAY[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium", display.className)}>
      {display.label}
    </Badge>
  );
}
