"use client";

import { computeBadges, BADGE_LABELS, type BadgeInput } from "../utils/badge-logic";
import { cn } from "@/lib/utils";

export function EventBadges({
  event,
  className,
}: {
  event: BadgeInput;
  className?: string;
}) {
  const badges = computeBadges(event);
  if (!badges.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => {
        const meta = BADGE_LABELS[b];
        return (
          <span
            key={b}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              meta.className,
            )}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </span>
        );
      })}
    </div>
  );
}
