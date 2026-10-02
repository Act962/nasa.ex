"use client";

import type { ComponentType } from "react";
import { Files, Layers3, LayoutTemplate, Settings2, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tab } from "./builder-sidebar-config";

export const BUILDER_SIDEBAR_TABS: { id: Tab; icon: ComponentType<{ className?: string }>; label: string }[] = [
  { id: "elements", icon: SquareStack, label: "Elementos" },
  { id: "blocks", icon: LayoutTemplate, label: "Blocos" },
  { id: "layers", icon: Layers3, label: "Camadas" },
  { id: "pages", icon: Files, label: "Páginas" },
  { id: "page", icon: Settings2, label: "Ajustes" },
];

export const ALL_BUILDER_SIDEBAR_TAB_IDS: Tab[] = BUILDER_SIDEBAR_TABS.map((tab) => tab.id);

/** Trilho em pílula das abas da sidebar (ícone em cima, rótulo embaixo). */
export function BuilderSidebarTabs({
  visibleTabIds,
  activeTab,
  onTabChange,
}: {
  visibleTabIds: Tab[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="mx-2 mt-2 mb-1 flex shrink-0 gap-0.5 rounded-full bg-panel p-1">
      {BUILDER_SIDEBAR_TABS.filter((tab) => visibleTabIds.includes(tab.id)).map(({ id, icon: TabIcon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          onClick={() => onTabChange(id)}
          className={cn(
            "flex min-h-9 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 py-1.5 transition-colors",
            activeTab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <TabIcon className="size-[18px] shrink-0" />
          <span className="max-w-full truncate text-[10px] leading-tight font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
}
