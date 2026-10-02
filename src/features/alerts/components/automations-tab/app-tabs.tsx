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
    <div className="overflow-x-auto">
      <div className="inline-flex gap-1 min-w-max rounded-full bg-panel p-1">
        {apps.map((app) => {
          const active = app.key === activeApp;
          return (
            <button
              key={app.key}
              type="button"
              onClick={() => onChange(app.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
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
