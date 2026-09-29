import { cn } from "@/lib/utils";
import type { SiteStatusTone } from "../utils/site-status";

const TONE_CLASS: Record<SiteStatusTone, string> = {
  active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  off: "bg-muted text-muted-foreground",
};

export function SiteStatusPill({ label, tone }: { label: string; tone: SiteStatusTone }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
