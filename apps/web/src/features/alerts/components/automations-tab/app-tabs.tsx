"use client";

import { cn } from "@/lib/utils";
import type { AppKey } from "@/features/alerts/lib/alert-catalog";

interface AppTabsProps {
  apps: { key: AppKey; label: string }[];
  activeApp: AppKey;
  onChange: (key: AppKey) => void;
}

/**
 * Strip horizontal de tabs por aplicação (Tracking, Workspace, Agenda…).
 * Scroll horizontal em mobile pra não quebrar layout.
 */
export function AppTabs({ apps, activeApp, onChange }: AppTabsProps) {
  if (apps.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        Sem aplicações no catálogo.
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-800/60 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {apps.map((app) => {
          const active = app.key === activeApp;
          return (
            <button
              key={app.key}
              type="button"
              onClick={() => onChange(app.key)}
              className={cn(
                "px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors border-b-2",
                active
                  ? "text-violet-300 border-violet-500"
                  : "text-zinc-400 hover:text-zinc-200 border-transparent",
              )}
            >
              {app.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
