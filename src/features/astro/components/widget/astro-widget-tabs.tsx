"use client";

import { cn } from "@/lib/utils";
import type { AstroWidgetView } from "@/features/astro/voice/use-astro-widget-store";

/**
 * Abas Início / Conversa do widget (spec 0029, RF-9). O contador em Início
 * soma avisos não lidos e aprovações — o que espera o usuário agora.
 */
export function AstroWidgetTabs({
  view,
  onViewChange,
  homeBadge,
}: {
  view: AstroWidgetView;
  onViewChange: (view: AstroWidgetView) => void;
  homeBadge: number;
}) {
  const tabs: Array<{ value: AstroWidgetView; label: string }> = [
    { value: "home", label: "Início" },
    { value: "chat", label: "Conversa" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Seções do Astro"
      className="flex shrink-0 gap-1 border-b border-white/[0.07] px-3 py-2"
    >
      {tabs.map((tab) => {
        const isActive = view === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onViewChange(tab.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] transition",
              isActive
                ? "bg-white/[0.09] font-medium text-white"
                : "text-white/45 hover:bg-white/[0.04] hover:text-white/70",
            )}
          >
            {tab.label}
            {tab.value === "home" && homeBadge > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                {homeBadge > 9 ? "9+" : homeBadge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
