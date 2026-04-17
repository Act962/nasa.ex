import React from "react";
import { nasaApps, integrationApps } from "../data/variables";
import type { AppItem } from "../data/variables";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface AppDropdownProps {
  search: string;
  onSelect: (value: string) => void;
}

export function AppDropdown({ search, onSelect }: AppDropdownProps) {
  const lower = search.toLowerCase();
  const match = (a: AppItem) =>
    lower === "" ||
    a.label.toLowerCase().includes(lower) ||
    a.id.toLowerCase().includes(lower);

  const filteredNasa = nasaApps.filter(match);
  const filteredIntegration = integrationApps.filter(match);
  const totalFiltered = filteredNasa.length + filteredIntegration.length;

  const renderGroup = (items: AppItem[], groupLabel: string) => {
    if (items.length === 0) return null;
    return (
      <DropdownMenuGroup key={groupLabel}>
        <div className="px-3 py-1.5 flex items-center gap-1.5 opacity-80 pointer-events-none">
          <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
            {groupLabel}
          </span>
        </div>
        {items.map((app) => (
          <DropdownMenuItem
            key={app.id}
            onClick={() => onSelect(app.label)}
            className="w-full flex items-center px-4 py-2 text-sm font-mono cursor-pointer focus:bg-zinc-800 transition-colors"
          >
            <span className={app.color}>{app.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
    );
  };

  return (
    <DropdownMenu open={true} modal={false}>
      <DropdownMenuTrigger className="opacity-0 w-0 h-0 p-0 m-0 border-0 absolute -top-8" />
      <DropdownMenuContent
        align="start"
        side="top"
        sideOffset={0}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-64 bg-zinc-900 border-zinc-700/60 p-0 shadow-2xl max-h-72 overflow-y-auto"
      >
        <DropdownMenuLabel className="px-3 py-2 border-b border-zinc-800 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
          #Apps NASA &amp; Integrações
        </DropdownMenuLabel>

        <div className="py-1">
          {renderGroup(filteredNasa, "🚀 NASA Apps")}
          {filteredNasa.length > 0 && filteredIntegration.length > 0 && (
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />
          )}
          {renderGroup(filteredIntegration, "🔌 Integrações")}
          {totalFiltered === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-600 outline-none">
              App não encontrado.
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
