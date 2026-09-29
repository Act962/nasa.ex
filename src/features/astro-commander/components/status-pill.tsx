"use client";

import { cn } from "@/lib/utils";
import type { AstroCommandStatus } from "@/generated/prisma/enums";

/**
 * Pílula de status do comando. Contorno colorido em vez de fundo cheio: numa
 * lista longa, badge sólido compete com o nome do comando.
 */
const TONES: Record<AstroCommandStatus, string> = {
  ACTIVE: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  PAUSED: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  DRAFT: "border-muted-foreground/30 text-muted-foreground",
  ARCHIVED: "border-muted-foreground/20 text-muted-foreground",
};

export function StatusPill({
  status,
  label,
}: {
  status: AstroCommandStatus;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        TONES[status],
      )}
    >
      {label}
    </span>
  );
}
