"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDE_ANCHORS } from "@/features/astro-guides/lib/anchors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Barra de navegação do módulo.
 *
 * Não quebra em duas linhas (a posição de cada aba mudaria com a largura) nem rola
 * escondida (a aba aberta podia ficar fora da vista): o que não cabe vai para "Mais".
 */

const TAB_GAP_PX = 4;
/** Seta do "Mais" quando ele mostra o nome da aba aberta. */
const MORE_CHEVRON_PX = 16;

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
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    function fitTabs() {
      if (!container || !measure) return;
      const tabWidths = Array.from(measure.children).map((child) => (child as HTMLElement).offsetWidth);
      const available = container.clientWidth;
      const totalWidth = tabWidths.reduce((sum, width) => sum + width + TAB_GAP_PX, 0);
      if (totalWidth <= available) return setVisibleCount(tabWidths.length);

      const moreWidth = Math.max(...tabWidths) + MORE_CHEVRON_PX + TAB_GAP_PX;
      let usedWidth = moreWidth;
      let fitCount = 0;
      for (const width of tabWidths) {
        if (usedWidth + width + TAB_GAP_PX > available) break;
        usedWidth += width + TAB_GAP_PX;
        fitCount += 1;
      }
      setVisibleCount(fitCount);
    }

    fitTabs();
    const observer = new ResizeObserver(fitTabs);
    observer.observe(container);
    return () => observer.disconnect();
  }, [tabs]);

  const visibleTabs = tabs.slice(0, visibleCount);
  const overflowTabs = tabs.slice(visibleCount);
  const activeOverflowTab = overflowTabs.find((tab) => tab.value === activeTab);

  return (
    <div className={cn("flex items-end gap-2 border-b border-border/50", className)}>
      <div
        ref={containerRef}
        className="relative flex min-w-0 flex-1 items-end gap-1 overflow-hidden"
        data-guide={GUIDE_ANCHORS.paymentTabsBar.id}
      >
        {visibleTabs.map((tab) => (
          <PaymentTabButton key={tab.value} tab={tab} isActive={activeTab === tab.value} onSelect={onSelect} />
        ))}

        {overflowTabs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pt-2 pb-2.5 text-[13px] font-medium outline-none transition-colors",
                  activeOverflowTab ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {activeOverflowTab ? (
                  <>
                    <activeOverflowTab.icon className="size-[15px] shrink-0 text-info" />
                    {activeOverflowTab.label}
                  </>
                ) : (
                  "Mais"
                )}
                <ChevronDown className="size-3 shrink-0 opacity-55" />
                {activeOverflowTab && <ActiveTabUnderline />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              {overflowTabs.map((tab) => (
                <DropdownMenuItem key={tab.value} onClick={() => onSelect(tab.value)} className="gap-2">
                  <tab.icon className={cn("size-4", activeTab === tab.value && "text-info")} />
                  <span className="flex-1">{tab.label}</span>
                  {activeTab === tab.value && <Check className="size-3.5 text-info" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute top-0 left-0 flex gap-1">
          {tabs.map((tab) => (
            <PaymentTabButton key={tab.value} tab={tab} isActive={false} onSelect={() => undefined} />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenSettings}
        title="Configurações do Payment"
        className="relative mb-1.5 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <Settings className="size-[15px]" />
        <span className="hidden lg:inline">Configurações</span>
        {settingsBadge > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-background bg-warning px-1 text-[10px] font-bold text-black/85">
            {settingsBadge > 99 ? "99+" : settingsBadge}
          </span>
        )}
      </button>
    </div>
  );
}

function ActiveTabUnderline() {
  return <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-info" />;
}

function PaymentTabButton({
  tab,
  isActive,
  onSelect,
}: {
  tab: PaymentTab;
  isActive: boolean;
  onSelect: (value: string) => void;
}) {
  const Icon = tab.icon;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onSelect(tab.value)}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pt-2 pb-2.5 text-[13px] font-medium transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[15px] shrink-0", isActive && "text-info")} />
      {tab.label}
      {tab.hasChildren && <ChevronDown className="size-3 shrink-0 opacity-55" />}
      {isActive && <ActiveTabUnderline />}
    </button>
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
    <div className="inline-flex w-fit gap-0.5 rounded-full bg-muted/60 p-1">
      {views.map((view) => {
        const Icon = view.icon;
        const isActive = activeView === view.value;
        return (
          <button
            key={view.value}
            type="button"
            onClick={() => onSelect(view.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-[13px]", isActive && "text-info")} />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
