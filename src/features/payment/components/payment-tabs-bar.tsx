"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de navegação do módulo.
 *
 * Rola na horizontal em vez de quebrar em duas linhas: com a fileira quebrada,
 * a posição de cada aba mudava conforme a largura e nada ficava onde o usuário
 * tinha deixado.
 */

export interface PaymentTab {
  value: string;
  label: string;
  icon: LucideIcon;
  /** A aba abre sub-visões próprias — a seta avisa que há conteúdo dentro. */
  hasChildren?: boolean;
}

export function PaymentTabsBar({
  tabs,
  activeTab,
  onSelect,
  onOpenSettings,
  settingsBadge = 0,
  className,
}: {
  tabs: PaymentTab[];
  activeTab: string;
  onSelect: (value: string) => void;
  onOpenSettings: () => void;
  settingsBadge?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex flex-1 items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.value)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-[#1E90FF]/35 bg-[#1E90FF]/12 text-[#cfe6ff]"
                  : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon className={cn("size-[15px] shrink-0", isActive && "text-[#1E90FF]")} />
              {tab.label}
              {tab.hasChildren && (
                <ChevronDown className="size-3 shrink-0 opacity-55" />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        title="Configurações do Payment"
        className="relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="size-[15px]" />
        <span className="hidden lg:inline">Configurações</span>
        {settingsBadge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-background bg-amber-500 px-1 text-[10px] font-bold text-amber-950">
            {settingsBadge > 99 ? "99+" : settingsBadge}
          </span>
        )}
      </button>
    </div>
  );
}

/** Seletor segmentado das sub-visões de uma aba. */
export function PaymentSubTabs({
  views,
  activeView,
  onSelect,
}: {
  views: Array<{ value: string; label: string; icon: LucideIcon }>;
  activeView: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="inline-flex w-fit gap-0.5 rounded-lg border border-border/60 bg-muted/40 p-0.5">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.value;
        return (
          <button
            key={view.value}
            type="button"
            onClick={() => onSelect(view.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-[13px]", isActive && "text-[#1E90FF]")} />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
