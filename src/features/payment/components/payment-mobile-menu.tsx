"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, Download, Loader2, Menu, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentTabItem = {
  value: string;
  label: string;
  emoji: string;
  badgeCount?: number;
};

/**
 * Menu único do Payment no mobile: navegação entre abas (que ficam ocultas em
 * telas pequenas) mais as ações que no desktop moram no header e na toolbar.
 */
export function PaymentMobileMenu({
  tabs,
  activeTab,
  onSelectTab,
  onOpenSettings,
  onExport,
  isExporting,
  className,
}: {
  tabs: PaymentTabItem[];
  activeTab: string;
  onSelectTab: (value: string) => void;
  onOpenSettings: () => void;
  onExport: () => void;
  isExporting: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-9", className)}
          aria-label="Menu do Payment"
          title="Menu"
        >
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Navegar
        </DropdownMenuLabel>
        {tabs.map((tab) => (
          <DropdownMenuItem
            key={tab.value}
            onClick={() => onSelectTab(tab.value)}
            className={cn("gap-2", tab.value === activeTab && "bg-accent")}
          >
            <span aria-hidden>{tab.emoji}</span>
            <span className="flex-1 truncate">{tab.label}</span>
            {tab.badgeCount ? (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                {tab.badgeCount > 99 ? "99+" : tab.badgeCount}
              </span>
            ) : null}
            {tab.value === activeTab && <Check className="size-3.5 shrink-0" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Ações
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={onExport}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Exportar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenSettings} className="gap-2">
          <Settings className="size-4" />
          Configurações
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
