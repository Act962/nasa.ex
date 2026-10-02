"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const OBLIGATION_STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Pendente", className: "border-warning/30 bg-warning/10 text-warning dark:text-warning" },
  DONE: { label: "Feita", className: "border-success/30 bg-success/10 text-success dark:text-success" },
  OVERDUE: { label: "Atrasada", className: "border-destructive/30 bg-destructive/10 text-destructive dark:text-destructive" },
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
